import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { closeIntegrationFirestore, seedGroupMovieForIntegration } from '../../functions/src/testing';

const projectId = 'demo-filmchat';
type TestUser = { uid: string; auth: Auth; db: Firestore; functions: Functions };
const testApps: FirebaseApp[] = [];

const createUser = async (email: string): Promise<TestUser> => {
  const app = initializeApp({ apiKey: 'demo-api-key', authDomain: `${projectId}.firebaseapp.com`, projectId }, `two-user-${email}`);
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

const call = async <Request, Response>(name: string, data: Request, user: TestUser) => {
  const response = await httpsCallable<Request, Response>(user.functions, name)(data);
  return response.data;
};

test('two independent users complete the durable group flow', async () => {
  const alice = await createUser('alice@example.com');
  await setDoc(doc(alice.db, 'users', alice.uid), { email: 'alice@example.com', displayName: 'Alice', createdAt: new Date(), updatedAt: new Date() });
  const bob = await createUser('bob@example.com');
  await setDoc(doc(bob.db, 'users', bob.uid), { email: 'bob@example.com', displayName: 'Bob', createdAt: new Date(), updatedAt: new Date() });

  const group = await call<{ name: string }, { groupId: string; inviteId: string; token: string }>('createGroup', { name: 'Integration Films' }, alice);
  const membership = await call<{ inviteId: string; token: string }, { groupId: string; membershipStatus: string }>('redeemInvite', { inviteId: group.inviteId, token: group.token }, bob);
  expect(membership).toMatchObject({ groupId: group.groupId, membershipStatus: 'joined' });

  await setDoc(doc(alice.db, `groups/${group.groupId}/messages/alice-message`), {
    type: 'text', authorId: alice.uid, authorDisplayNameSnapshot: 'Alice', text: 'Movie night?', createdAt: new Date(), clientRequestId: 'alice-message',
  });
  await setDoc(doc(bob.db, `groups/${group.groupId}/messages/bob-message`), {
    type: 'text', authorId: bob.uid, authorDisplayNameSnapshot: 'Bob', text: 'The Matrix.', createdAt: new Date(), clientRequestId: 'bob-message',
  });

  await seedGroupMovieForIntegration(group.groupId, 'tmdb_603');
  await call('saveWatchNote', { groupId: group.groupId, groupMovieId: 'tmdb_603', rating: 5, reviewText: 'Still excellent', watchedOn: 'Cinema' }, alice);
  await call('saveWatchNote', { groupId: group.groupId, groupMovieId: 'tmdb_603', rating: 3, reviewText: '', watchedOn: 'Blu-ray' }, bob);

  const movie = await getDoc(doc(alice.db, `groups/${group.groupId}/groupMovies/tmdb_603`));
  expect(movie.data()).toMatchObject({ ratingCount: 2, ratingSum: 8, ratingAverage: 4 });

  await call('saveWatchNote', { groupId: group.groupId, groupMovieId: 'tmdb_603', rating: 4, reviewText: 'Still excellent', watchedOn: 'Cinema' }, alice);
  await call('saveWatchNote', { groupId: group.groupId, groupMovieId: 'tmdb_603', remove: true, rating: 5 }, bob);
  const updatedMovie = await getDoc(doc(alice.db, `groups/${group.groupId}/groupMovies/tmdb_603`));
  expect(updatedMovie.data()).toMatchObject({ ratingCount: 1, ratingSum: 4, ratingAverage: 4 });

  await call('leaveGroup', { groupId: group.groupId }, bob);
  await expect(getDoc(doc(bob.db, `groups/${group.groupId}/messages/alice-message`))).rejects.toThrow();
  await call('redeemInvite', { inviteId: group.inviteId, token: group.token }, bob);
  await expect(getDoc(doc(alice.db, `groups/${group.groupId}/groupMovies/tmdb_603/watchNotes/${alice.uid}`))).resolves.toBeDefined();
}, 30000);
