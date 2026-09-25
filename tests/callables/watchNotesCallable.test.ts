import { getFirestore } from '../../functions/node_modules/firebase-admin/lib/firestore/index.js';
import { saveWatchNote } from '../../functions/src/index';

const firestore = getFirestore();
const groupId = 'watch-note-test-group';
const groupMovieId = 'tmdb_603';
const userId = 'watch-note-user';

const callSaveWatchNote = (data: Record<string, unknown>) => saveWatchNote.run({
  data,
  auth: { uid: userId },
} as unknown as Parameters<typeof saveWatchNote.run>[0]);

const movieReference = firestore.doc(`groups/${groupId}/groupMovies/${groupMovieId}`);
const noteReference = movieReference.collection('watchNotes').doc(userId);

beforeAll(async () => {
  await firestore.doc(`users/${userId}`).set({ displayName: 'Test User' });
  await firestore.doc(`groups/${groupId}/members/${userId}`).set({ status: 'active' });
  await movieReference.set({
    provider: 'tmdb',
    externalMovieId: '603',
    title: 'The Matrix',
    ratingCount: 0,
    ratingSum: 0,
    ratingAverage: null,
  });
});

afterEach(async () => {
  await noteReference.delete();
  await movieReference.update({ ratingCount: 0, ratingSum: 0, ratingAverage: null });
});

afterAll(async () => {
  await firestore.doc(`users/${userId}`).delete();
  await firestore.doc(`groups/${groupId}/members/${userId}`).delete();
  await movieReference.delete();
});

describe('saveWatchNote callable', () => {
  it('creates, updates, and removes a rated watch note', async () => {
    await callSaveWatchNote({ groupId, groupMovieId, rating: 5, reviewText: 'Excellent', watchedOn: 'Cinema' });
    await expect((await noteReference.get()).data()).toMatchObject({ userId, rating: 5, reviewText: 'Excellent' });
    await expect((await movieReference.get()).data()).toMatchObject({ ratingCount: 1, ratingSum: 5, ratingAverage: 5 });

    await callSaveWatchNote({ groupId, groupMovieId, rating: 3, reviewText: 'Still good', watchedOn: 'Blu-ray' });
    await expect((await movieReference.get()).data()).toMatchObject({ ratingCount: 1, ratingSum: 3, ratingAverage: 3 });

    await callSaveWatchNote({ groupId, groupMovieId, remove: true });
    await expect((await noteReference.get()).exists).toBe(false);
    await expect((await movieReference.get()).data()).toMatchObject({ ratingCount: 0, ratingSum: 0, ratingAverage: null });
  });

  it('ignores a forged rating in a removal payload', async () => {
    await callSaveWatchNote({ groupId, groupMovieId, rating: 4, reviewText: 'Worth seeing', watchedOn: 'Cinema' });
    await callSaveWatchNote({ groupId, groupMovieId, remove: true, rating: 5 });

    await expect((await noteReference.get()).exists).toBe(false);
    await expect((await movieReference.get()).data()).toMatchObject({ ratingCount: 0, ratingSum: 0, ratingAverage: null });
  });
});