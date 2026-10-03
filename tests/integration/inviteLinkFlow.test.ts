import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { closeIntegrationFirestore } from '../../functions/src/testing';
import { buildInviteLink, parseInviteLink } from '../../src/utils/inviteLink';

const projectId = 'demo-filmchat';
type TestUser = { uid: string; auth: Auth; db: Firestore; functions: Functions };
const testApps: FirebaseApp[] = [];

const createUser = async (email: string): Promise<TestUser> => {
  const app = initializeApp({ apiKey: 'demo-api-key', authDomain: `${projectId}.firebaseapp.com`, projectId }, `invite-link-${email}`);
  testApps.push(app);
  const userAuth = getAuth(app);
  const userDb = getFirestore(app);
  const userFunctions = getFunctions(app);
  connectAuthEmulator(userAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(userDb, '127.0.0.1', 8080);
  connectFunctionsEmulator(userFunctions, '127.0.0.1', 5001);
  const credential = await createUserWithEmailAndPassword(userAuth, email, 'password123');
  return { uid: credential.user.uid, auth: userAuth, db: userDb, functions: userFunctions };
};

afterAll(async () => {
  await closeIntegrationFirestore();
  await Promise.all(testApps.map((app) => deleteApp(app)));
});

const call = async <Request, Response>(name: string, data: Request, user: TestUser): Promise<Response> => {
  const response = await httpsCallable<Request, Response>(user.functions, name)(data);
  return response.data;
};

describe('invite link emulator flow', () => {
  test('creates, previews, and redeems a valid invite using a parsed HTTPS invite URL', async () => {
    const alice = await createUser('alice-invite-link@example.com');
    await setDoc(doc(alice.db, 'users', alice.uid), { email: 'alice-invite-link@example.com', displayName: 'Alice', createdAt: new Date(), updatedAt: new Date() });
    const bob = await createUser('bob-invite-link@example.com');
    await setDoc(doc(bob.db, 'users', bob.uid), { email: 'bob-invite-link@example.com', displayName: 'Bob', createdAt: new Date(), updatedAt: new Date() });

    const group = await call<{ name: string }, { groupId: string; inviteId: string; token: string; groupName: string }>('createGroup', { name: 'Invite Link Group' }, alice);
    const parsedInvite = parseInviteLink(buildInviteLink({ inviteId: group.inviteId, token: group.token }));
    expect(parsedInvite).toEqual({ inviteId: group.inviteId, token: group.token });

    const preview = await call<{ inviteId: string; token: string }, { available: boolean; groupId: string; groupName: string }>('previewInvite', parsedInvite!, alice);
    expect(preview).toMatchObject({ available: true, groupId: group.groupId, groupName: 'Invite Link Group' });

    const firstRedeem = await call<{ inviteId: string; token: string }, { groupId: string; groupName: string; membershipStatus: 'active' | 'joined' }>('redeemInvite', parsedInvite!, bob);
    expect(firstRedeem).toMatchObject({ groupId: group.groupId, groupName: 'Invite Link Group', membershipStatus: 'joined' });

    const membership = await getDoc(doc(alice.db, `groups/${group.groupId}/members/${bob.uid}`));
    expect(membership.data()).toMatchObject({ userId: bob.uid, status: 'active', role: 'member' });

    const secondRedeem = await call<{ inviteId: string; token: string }, { groupId: string; groupName: string; membershipStatus: 'active' | 'joined' }>('redeemInvite', parsedInvite!, bob);
    expect(secondRedeem).toMatchObject({ groupId: group.groupId, membershipStatus: 'active' });

    const otherGroup = await call<{ name: string }, { groupId: string; inviteId: string; token: string; groupName: string }>('createGroup', { name: 'Other Group' }, bob);
    const previewForOriginalGroup = await call<{ inviteId: string; token: string }, { available: boolean; groupId: string; groupName: string }>('previewInvite', parsedInvite!, bob);
    expect(previewForOriginalGroup.groupId).toBe(group.groupId);
    expect(previewForOriginalGroup.groupId).not.toBe(otherGroup.groupId);
  }, 30000);

  test('rejects invalid tokens and only allows the original invite group to be used', async () => {
    const alice = await createUser('alice-invalid-invite@example.com');
    const bob = await createUser('bob-invalid-invite@example.com');
    await setDoc(doc(alice.db, 'users', alice.uid), { email: 'alice-invalid-invite@example.com', displayName: 'Alice', createdAt: new Date(), updatedAt: new Date() });
    await setDoc(doc(bob.db, 'users', bob.uid), { email: 'bob-invalid-invite@example.com', displayName: 'Bob', createdAt: new Date(), updatedAt: new Date() });

    const groupA = await call<{ name: string }, { groupId: string; inviteId: string; token: string; groupName: string }>('createGroup', { name: 'Original Group' }, alice);
    const inviteA = { inviteId: groupA.inviteId, token: groupA.token };
    const invalidTokenInvite = { inviteId: groupA.inviteId, token: 'not-the-right-token' };

    await expect(call<{ inviteId: string; token: string }, { groupId: string; groupName: string; membershipStatus: 'active' | 'joined' }>('redeemInvite', invalidTokenInvite, bob)).rejects.toThrow();

    const preview = await call<{ inviteId: string; token: string }, { available: boolean; groupId: string; groupName: string }>('previewInvite', inviteA, bob);
    expect(preview).toMatchObject({ available: true, groupId: groupA.groupId, groupName: 'Original Group' });

    const groupB = await call<{ name: string }, { groupId: string; inviteId: string; token: string; groupName: string }>('createGroup', { name: 'Second Group' }, bob);
    const previewFromWrongGroup = await call<{ inviteId: string; token: string }, { available: boolean; groupId: string; groupName: string }>('previewInvite', inviteA, bob);
    expect(previewFromWrongGroup.groupId).toBe(groupA.groupId);
    expect(previewFromWrongGroup.groupId).not.toBe(groupB.groupId);
  }, 30000);
});
