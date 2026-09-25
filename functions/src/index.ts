import { createHash, randomBytes } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getTmdbMovie, searchTmdb, type MovieCatalogResult } from './tmdb';

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

const maxRecommendationNoteLength = 500;
const maxWatchNoteReviewLength = 1000;
const maxWatchNotePlatformLength = 80;
const minWatchNoteRating = 1;
const maxWatchNoteRating = 5;

function requireBoundedString(value: unknown, field: string, maxLength: number) {
	const result = requireString(value, field);
	if (result.length > maxLength) {
		throw new HttpsError('invalid-argument', `${field} must be ${maxLength} characters or fewer.`);
	}
	return result;
}

function requireClientRequestId(value: unknown) {
	return requireBoundedString(value, 'Client request ID', 120);
}

function groupMovieId(movie: MovieCatalogResult) {
	return `tmdb_${movie.externalMovieId}`;
}

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

export const searchMovies = onCall(async (request) => {
	requireAuth(request);
	const query = requireBoundedString(request.data?.query, 'Search query', 100);
	if (query.length < 2) {
		throw new HttpsError('invalid-argument', 'Search query must be at least 2 characters.');
	}
	return { results: await searchTmdb(query) };
});

export const recommendMovie = onCall(async (request) => {
	const uid = requireAuth(request);
	const groupId = requireString(request.data?.groupId, 'Group ID');
	const externalMovieId = requireBoundedString(request.data?.externalMovieId, 'Movie ID', 30);
	const clientRequestId = requireClientRequestId(request.data?.clientRequestId);
	const note = typeof request.data?.note === 'string' ? request.data.note.trim() : '';
	if (note.length > maxRecommendationNoteLength) {
		throw new HttpsError('invalid-argument', 'Recommendation note must be 500 characters or fewer.');
	}

	const groupRef = firestore.collection('groups').doc(groupId);
	const memberRef = groupRef.collection('members').doc(uid);
	const [groupSnapshot, memberSnapshot, movie] = await Promise.all([
		groupRef.get(),
		memberRef.get(),
		getTmdbMovie(externalMovieId),
	]);
	if (!groupSnapshot.exists || !memberSnapshot.exists || memberSnapshot.data()?.status !== 'active') {
		throw new HttpsError('permission-denied', 'Active group membership is required.');
	}

	const userSnapshot = await firestore.collection('users').doc(uid).get();
	const displayName = (userSnapshot.data() as { displayName?: string } | undefined)?.displayName ?? '';
	const messageId = `movie_${uid}_${clientRequestId}`;
	const messageRef = groupRef.collection('messages').doc(messageId);
	const groupMovieRef = groupRef.collection('groupMovies').doc(groupMovieId(movie));
	const historyRef = groupMovieRef.collection('recommendations').doc(messageId);
	const timestamp = FieldValue.serverTimestamp();

	await firestore.runTransaction(async (transaction) => {
		const existing = await transaction.get(messageRef);
		if (existing.exists) {
			const existingData = existing.data();
			if (existingData?.authorId !== uid || existingData.clientRequestId !== clientRequestId) {
				throw new HttpsError('already-exists', 'This recommendation request ID is already in use.');
			}
			return;
		}
		const existingMovie = await transaction.get(groupMovieRef);
		const movieData = {
			provider: movie.provider,
			externalMovieId: movie.externalMovieId,
			title: movie.title,
			releaseYear: movie.releaseYear,
			posterPath: movie.posterPath,
			overview: movie.overview,
		};
		transaction.create(messageRef, {
			type: 'movie_recommendation',
			authorId: uid,
			authorDisplayNameSnapshot: displayName,
			text: note || null,
			createdAt: timestamp,
			clientRequestId,
			movie: movieData,
			groupMovieId: groupMovieId(movie),
		});
		if (existingMovie.exists) {
			transaction.set(groupMovieRef, {
				lastRecommendedAt: timestamp,
				recommendationCount: (existingMovie.data()?.recommendationCount ?? 0) + 1,
				recommenderIds: Array.from(new Set([...(existingMovie.data()?.recommenderIds ?? []), uid])).slice(0, 100),
				updatedAt: timestamp,
			}, { merge: true });
		} else {
			transaction.create(groupMovieRef, {
				...movieData,
				firstRecommendedAt: timestamp,
				lastRecommendedAt: timestamp,
				firstRecommendationMessageId: messageId,
				recommendationCount: 1,
				recommenderIds: [uid],
				ratingCount: 0,
				ratingSum: 0,
				ratingAverage: null,
				updatedAt: timestamp,
			});
		}
		transaction.create(historyRef, {
			messageId,
			authorId: uid,
			authorDisplayNameSnapshot: displayName,
			note: note || null,
			createdAt: timestamp,
		});
		transaction.update(groupRef, {
			updatedAt: timestamp,
			lastActivityAt: timestamp,
			lastActivityPreview: `Recommended ${movie.title}`.slice(0, 200),
		});
	});

	return { messageId, clientRequestId, movie, groupMovieId: groupMovieId(movie), note: note || null };
});

export const saveWatchNote = onCall(async (request) => {
	const uid = requireAuth(request);
	const groupId = requireString(request.data?.groupId, 'Group ID');
	const groupMovieIdValue = requireString(request.data?.groupMovieId, 'Group movie ID');
	const remove = request.data?.remove === true;
	const rawRating = request.data?.rating;
	const rating = rawRating === null || rawRating === undefined || rawRating === '' ? null : rawRating;
	if (rating !== null && (typeof rating !== 'number' || !Number.isInteger(rating) || rating < minWatchNoteRating || rating > maxWatchNoteRating)) {
		throw new HttpsError('invalid-argument', 'Rating must be an integer from 1 to 5.');
	}
	const reviewText = typeof request.data?.reviewText === 'string' ? request.data.reviewText.trim() : '';
	if (reviewText.length > maxWatchNoteReviewLength) {
		throw new HttpsError('invalid-argument', `Review must be ${maxWatchNoteReviewLength} characters or fewer.`);
	}
	const watchedOn = typeof request.data?.watchedOn === 'string' ? request.data.watchedOn.trim() : '';
	if (watchedOn.length > maxWatchNotePlatformLength) {
		throw new HttpsError('invalid-argument', `Platform must be ${maxWatchNotePlatformLength} characters or fewer.`);
	}
	if (!remove && rating === null && reviewText.length === 0 && watchedOn.length === 0) {
		throw new HttpsError('invalid-argument', 'At least one watch-note field is required.');
	}

	const groupRef = firestore.collection('groups').doc(groupId);
	const memberRef = groupRef.collection('members').doc(uid);
	const groupMovieRef = groupRef.collection('groupMovies').doc(groupMovieIdValue);
	const watchNoteRef = groupMovieRef.collection('watchNotes').doc(uid);
	const userSnapshot = await firestore.collection('users').doc(uid).get();
	const displayNameSnapshot = (userSnapshot.data() as { displayName?: string } | undefined)?.displayName ?? '';

	await firestore.runTransaction(async (transaction) => {
		const [memberSnapshot, movieSnapshot, noteSnapshot] = await Promise.all([
			transaction.get(memberRef),
			transaction.get(groupMovieRef),
			transaction.get(watchNoteRef),
		]);
		if (!memberSnapshot.exists || memberSnapshot.data()?.status !== 'active') {
			throw new HttpsError('permission-denied', 'Active group membership is required.');
		}
		if (!movieSnapshot.exists) {
			throw new HttpsError('not-found', 'The group movie was not found.');
		}

		const existingRating = noteSnapshot.data()?.rating;
		const oldRating = typeof existingRating === 'number' ? existingRating : null;
		const ratingChanged = oldRating !== rating;
		const currentCount = typeof movieSnapshot.data()?.ratingCount === 'number' ? movieSnapshot.data()?.ratingCount : 0;
		const currentSum = typeof movieSnapshot.data()?.ratingSum === 'number' ? movieSnapshot.data()?.ratingSum : 0;
		let nextCount = currentCount;
		let nextSum = currentSum;
		if (ratingChanged) {
			if (oldRating !== null) { nextCount -= 1; nextSum -= oldRating; }
			if (rating !== null) { nextCount += 1; nextSum += rating; }
		}
		nextCount = Math.max(0, nextCount);
		nextSum = Math.max(0, nextSum);
		const nextAverage = nextCount > 0 ? Math.round((nextSum / nextCount) * 10) / 10 : null;
		const timestamp = FieldValue.serverTimestamp();

		if (remove) {
			if (noteSnapshot.exists) transaction.delete(watchNoteRef);
		} else {
			transaction.set(watchNoteRef, {
				userId: uid,
				displayNameSnapshot,
				rating,
				reviewText: reviewText || null,
				watchedOn: watchedOn || null,
				createdAt: noteSnapshot.data()?.createdAt ?? timestamp,
				updatedAt: timestamp,
			}, { merge: true });
		}
		if (ratingChanged || remove && noteSnapshot.exists) {
			transaction.update(groupMovieRef, {
				ratingCount: nextCount,
				ratingSum: nextSum,
				ratingAverage: nextAverage,
				updatedAt: timestamp,
			});
		}
	});

	return { groupId, groupMovieId: groupMovieIdValue, removed: remove };
});
