import { getFirestore } from '../../functions/node_modules/firebase-admin/lib/firestore/index.js';
import { enrichGroupMovieMetadata as enrichGroupMovieMetadataCallable, recommendMovie, saveWatchNote } from '../../functions/src/index';
import * as tmdbModule from '../../functions/src/tmdb';

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

describe('recommendMovie callable', () => {
  const recommendationGroupId = 'recommendation-fanout-group';
  const recommenderId = 'recommendation-recommender';
  const recipientId = 'recommendation-recipient';
  const groupMovieId = 'tmdb_603';
  const recommendationMessageId = `movie_${recommenderId}_req-1`;

  beforeEach(async () => {
    jest.spyOn(tmdbModule, 'getTmdbMovie').mockResolvedValue({
      provider: 'tmdb',
      externalMovieId: '603',
      title: 'The Matrix',
      releaseYear: 1999,
      posterPath: '/matrix.jpg',
      overview: 'A classic',
    });

    await firestore.doc(`users/${recommenderId}`).set({ displayName: 'Alice' });
    await firestore.doc(`users/${recipientId}`).set({ displayName: 'Bob' });

    await firestore.doc(`groups/${recommendationGroupId}`).set({
      name: 'Recommendation Fanout Group',
      ownerId: recommenderId,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
      lastActivityPreview: '',
    });

    await firestore.doc(`groups/${recommendationGroupId}/members/${recommenderId}`).set({
      userId: recommenderId,
      displayNameSnapshot: 'Alice',
      role: 'owner',
      status: 'active',
      joinedAt: new Date(),
      updatedAt: new Date(),
    });

    await firestore.doc(`groups/${recommendationGroupId}/members/${recipientId}`).set({
      userId: recipientId,
      displayNameSnapshot: 'Bob',
      role: 'member',
      status: 'active',
      joinedAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await firestore.doc(`users/${recommenderId}/receivedRecommendations/${recommendationMessageId}`).delete();
    await firestore.doc(`users/${recipientId}/receivedRecommendations/${recommendationMessageId}`).delete();
    await firestore.doc(`groups/${recommendationGroupId}/groupMovies/${groupMovieId}`).delete();
    await firestore.doc(`groups/${recommendationGroupId}/messages/${recommendationMessageId}`).delete();
    await firestore.doc(`groups/${recommendationGroupId}/groupMovies/${groupMovieId}/recommendations/${recommendationMessageId}`).delete();
    await firestore.doc(`groups/${recommendationGroupId}/members/${recommenderId}`).delete();
    await firestore.doc(`groups/${recommendationGroupId}/members/${recipientId}`).delete();
    await firestore.doc(`groups/${recommendationGroupId}`).delete();
    await firestore.doc(`users/${recommenderId}`).delete();
    await firestore.doc(`users/${recipientId}`).delete();
  });

  it('creates a personal recommendation inbox entry for each active recipient', async () => {
    await recommendMovie.run({
      data: {
        groupId: recommendationGroupId,
        externalMovieId: '603',
        clientRequestId: 'req-1',
        note: 'Great movie',
      },
      auth: { uid: recommenderId },
    } as Parameters<typeof recommendMovie.run>[0]);

    const recipientInbox = await firestore.doc(`users/${recipientId}/receivedRecommendations/${recommendationMessageId}`).get();
    expect(recipientInbox.exists).toBe(true);
    expect(recipientInbox.data()).toMatchObject({
      groupId: recommendationGroupId,
      groupName: 'Recommendation Fanout Group',
      title: 'The Matrix',
      recommendedByUserId: recommenderId,
      recommendedByDisplayNameSnapshot: 'Alice',
      note: 'Great movie',
      seen: false,
    });

    const recommenderInbox = await firestore.doc(`users/${recommenderId}/receivedRecommendations/${recommendationMessageId}`).get();
    expect(recommenderInbox.exists).toBe(false);
  });
});

describe('enrichGroupMovieMetadata callable', () => {
  const metadataGroupId = 'metadata-enrichment-group';
  const metadataGroupMovieId = 'tmdb_603';
  const metadataUserId = 'metadata-enrichment-user';
  const metadataMovieReference = firestore.doc(`groups/${metadataGroupId}/groupMovies/${metadataGroupMovieId}`);

  const callEnrichMetadata = (uid: string | null = metadataUserId) => enrichGroupMovieMetadataCallable.run({
    data: { groupId: metadataGroupId, groupMovieId: metadataGroupMovieId },
    auth: uid ? { uid } : null,
  } as unknown as Parameters<typeof enrichGroupMovieMetadataCallable.run>[0]);

  beforeEach(async () => {
    jest.spyOn(tmdbModule, 'getTmdbMovie').mockResolvedValue({
      provider: 'tmdb',
      externalMovieId: '603',
      title: 'The Matrix',
      originalTitle: 'The Matrix',
      imdbId: 'tt0133093',
      releaseYear: 1999,
      posterPath: '/matrix.jpg',
      overview: 'A classic',
    });
    await firestore.doc(`groups/${metadataGroupId}`).set({ name: 'Metadata Group' });
    await firestore.doc(`groups/${metadataGroupId}/members/${metadataUserId}`).set({ status: 'active' });
    await metadataMovieReference.set({
      provider: 'tmdb',
      externalMovieId: '603',
      title: 'The Matrix',
      recommendationCount: 4,
      ratingCount: 2,
      ratingSum: 9,
      ratingAverage: 4.5,
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await metadataMovieReference.delete();
    await firestore.doc(`groups/${metadataGroupId}/members/${metadataUserId}`).delete();
    await firestore.doc(`groups/${metadataGroupId}/members/inactive-metadata-user`).delete();
    await firestore.doc(`groups/${metadataGroupId}`).delete();
  });

  it('backfills metadata without changing existing movie aggregates', async () => {
    const result = await callEnrichMetadata();

    expect(result).toMatchObject({ originalTitle: 'The Matrix', imdbId: 'tt0133093' });
    expect((await metadataMovieReference.get()).data()).toMatchObject({
      originalTitle: 'The Matrix',
      imdbId: 'tt0133093',
      recommendationCount: 4,
      ratingCount: 2,
      ratingSum: 9,
      ratingAverage: 4.5,
    });
  });

  it('denies inactive members before requesting movie metadata', async () => {
    await firestore.doc(`groups/${metadataGroupId}/members/inactive-metadata-user`).set({ status: 'left' });

    await expect(callEnrichMetadata('inactive-metadata-user')).rejects.toMatchObject({ code: 'permission-denied' });
    expect(tmdbModule.getTmdbMovie).not.toHaveBeenCalled();
  });
});