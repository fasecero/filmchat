import { createHash, randomBytes } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

if (getApps().length === 0) {
	initializeApp();
}

const firestore = getFirestore();
const inviteTokenBytes = 32;
const inviteCollection = 'invites';

type InviteRecord = {
	groupId: string;
	tokenHash: string;
	status: 'active' | 'disabled';
	createdAt: FirebaseFirestore.Timestamp | FieldValue;
	updatedAt: FirebaseFirestore.Timestamp | FieldValue;
};

type GroupRecord = {
	name: string;
	ownerId: string;
	deletedAt?: FirebaseFirestore.Timestamp | null;
};

function requireAuth(request: { auth?: { uid: string } | null }) {
	if (!request.auth) {
		throw new HttpsError('unauthenticated', 'Authentication is required.');
	}
	return request.auth.uid;
}

function requireString(value: unknown, field: string) {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new HttpsError('invalid-argument', `${field} is required.`);
	}
	return value.trim();
}

function hashInviteToken(token: string) {
	return createHash('sha256').update(token, 'utf8').digest('hex');
}

function createInviteValues(groupId: string) {
	const token = randomBytes(inviteTokenBytes).toString('base64url');
	const timestamp = FieldValue.serverTimestamp();
	const record: InviteRecord = {
		groupId,
		tokenHash: hashInviteToken(token),
		status: 'active',
		createdAt: timestamp,
		updatedAt: timestamp,
	};
	return { token, record };
}

function unavailableInvite() {
	throw new HttpsError('not-found', 'This invite is unavailable.');
}

async function readActiveInvite(inviteId: string, token: string) {
	const inviteSnapshot = await firestore.collection(inviteCollection).doc(inviteId).get();
	if (!inviteSnapshot.exists) unavailableInvite();

	const invite = inviteSnapshot.data() as InviteRecord;
	if (invite.status !== 'active' || invite.tokenHash !== hashInviteToken(token)) {
		unavailableInvite();
	}

	const groupSnapshot = await firestore.collection('groups').doc(invite.groupId).get();
	if (!groupSnapshot.exists) unavailableInvite();

	const group = groupSnapshot.data() as GroupRecord;
	if (group.deletedAt) unavailableInvite();

	return { invite, group, groupId: invite.groupId };
}

async function createInviteTransaction(
	transaction: FirebaseFirestore.Transaction,
	groupId: string,
) {
	const inviteRef = firestore.collection(inviteCollection).doc();
	const { token, record } = createInviteValues(groupId);
	transaction.set(inviteRef, record);
	return { inviteId: inviteRef.id, token };
}

export const createGroup = onCall(async (request) => {
	const uid = requireAuth(request);
	const name = requireString(request.data?.name, 'Group name');
	if (name.length > 60) {
		throw new HttpsError('invalid-argument', 'Group name must be 60 characters or fewer.');
	}

	const userSnapshot = await firestore.collection('users').doc(uid).get();
	if (!userSnapshot.exists) {
		throw new HttpsError('failed-precondition', 'A user profile is required.');
	}
	const user = userSnapshot.data() as { displayName?: string };
	const groupRef = firestore.collection('groups').doc();
	const memberRef = groupRef.collection('members').doc(uid);
	const userGroupRef = firestore.collection('users').doc(uid).collection('groups').doc(groupRef.id);
	const timestamp = FieldValue.serverTimestamp();

	const result = await firestore.runTransaction(async (transaction) => {
		const invite = await createInviteTransaction(transaction, groupRef.id);
		transaction.set(groupRef, {
			name,
			ownerId: uid,
			createdAt: timestamp,
			updatedAt: timestamp,
			lastActivityAt: timestamp,
			lastActivityPreview: '',
		});
		transaction.set(memberRef, {
			userId: uid,
			displayNameSnapshot: user.displayName ?? '',
			role: 'owner',
			status: 'active',
			joinedAt: timestamp,
			updatedAt: timestamp,
		});
		transaction.set(userGroupRef, {
			groupId: groupRef.id,
			name,
			status: 'active',
			updatedAt: timestamp,
		});
		return invite;
	});

	return { groupId: groupRef.id, name, ownerId: uid, ...result };
});

export const createInvite = onCall(async (request) => {
	const uid = requireAuth(request);
	const groupId = requireString(request.data?.groupId, 'Group ID');
	const groupRef = firestore.collection('groups').doc(groupId);
	const memberRef = groupRef.collection('members').doc(uid);
	const [groupSnapshot, memberSnapshot] = await Promise.all([groupRef.get(), memberRef.get()]);
	if (!groupSnapshot.exists || !memberSnapshot.exists || memberSnapshot.data()?.status !== 'active') {
		throw new HttpsError('permission-denied', 'Active group membership is required.');
	}

	const result = await firestore.runTransaction((transaction) =>
		createInviteTransaction(transaction, groupId));
	return { groupId, groupName: (groupSnapshot.data() as GroupRecord).name, ...result };
});

export const previewInvite = onCall(async (request) => {
	const inviteId = requireString(request.data?.inviteId, 'Invite ID');
	const token = requireString(request.data?.token, 'Invite token');
	const { group, groupId } = await readActiveInvite(inviteId, token);
	return { available: true, groupId, groupName: group.name };
});

export const redeemInvite = onCall(async (request) => {
	const uid = requireAuth(request);
	const inviteId = requireString(request.data?.inviteId, 'Invite ID');
	const token = requireString(request.data?.token, 'Invite token');
	const { group, groupId } = await readActiveInvite(inviteId, token);
	const memberRef = firestore.collection('groups').doc(groupId).collection('members').doc(uid);
	const userGroupRef = firestore.collection('users').doc(uid).collection('groups').doc(groupId);
	const userSnapshot = await firestore.collection('users').doc(uid).get();
	const displayName = (userSnapshot.data() as { displayName?: string } | undefined)?.displayName ?? '';

	const membershipStatus = await firestore.runTransaction(async (transaction) => {
		const memberSnapshot = await transaction.get(memberRef);
		const timestamp = FieldValue.serverTimestamp();
		const existing = memberSnapshot.data();
		const status = existing?.status === 'active' ? 'active' : 'joined';
		transaction.set(memberRef, {
			userId: uid,
			displayNameSnapshot: existing?.displayNameSnapshot ?? displayName,
			role: existing?.role ?? 'member',
			status: 'active',
			joinedAt: existing?.joinedAt ?? timestamp,
			leftAt: FieldValue.delete(),
			updatedAt: timestamp,
		}, { merge: true });
		transaction.set(userGroupRef, {
			groupId,
			name: group.name,
			status: 'active',
			updatedAt: timestamp,
		}, { merge: true });
		return status;
	});

	return { groupId, groupName: group.name, membershipStatus };
});

export const leaveGroup = onCall(async (request) => {
	const uid = requireAuth(request);
	const groupId = requireString(request.data?.groupId, 'Group ID');
	const memberRef = firestore.collection('groups').doc(groupId).collection('members').doc(uid);
	const userGroupRef = firestore.collection('users').doc(uid).collection('groups').doc(groupId);

	await firestore.runTransaction(async (transaction) => {
		const memberSnapshot = await transaction.get(memberRef);
		if (!memberSnapshot.exists || memberSnapshot.data()?.status !== 'active') {
			throw new HttpsError('failed-precondition', 'You are not an active member of this group.');
		}
		const timestamp = FieldValue.serverTimestamp();
		transaction.update(memberRef, { status: 'left', leftAt: timestamp, updatedAt: timestamp });
		transaction.set(userGroupRef, { status: 'left', updatedAt: timestamp }, { merge: true });
	});

	return { groupId, status: 'left' };
});
