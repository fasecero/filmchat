import { getFirestore } from '../../functions/node_modules/firebase-admin/lib/firestore/index.js';
import { deleteMovieRecommendation, enrichGroupMovieMetadata as enrichGroupMovieMetadataCallable, recommendMovie, saveWatchNote, setMovieSeenStatus, updateDisplayName } from '../../functions/src/index';
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
  it('touches the parent movie when a review-only watch note changes', async () => {
    await callSaveWatchNote({ groupId, groupMovieId, rating: null, reviewText: 'A note without a rating', watchedOn: '' });
    expect((await movieReference.get()).data()?.updatedAt).toBeDefined();
    expect((await movieReference.get()).data()).toMatchObject({ ratingCount: 0, ratingSum: 0, ratingAverage: null });
  });

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

describe('updateDisplayName callable', () => {
  const profileUserId = 'display-name-update-user';
  const activeGroupId = 'display-name-active-group';
  const inactiveGroupId = 'display-name-inactive-group';
  const userRef = firestore.doc(`users/${profileUserId}`);
  const activeMembershipRef = firestore.doc(`groups/${activeGroupId}/members/${profileUserId}`);
  const inactiveMembershipRef = firestore.doc(`groups/${inactiveGroupId}/members/${profileUserId}`);
  const historicMessageRef = firestore.doc(`groups/${activeGroupId}/messages/historic-message`);

  const callUpdateDisplayName = (displayName: unknown, uid: string | null = profileUserId) => updateDisplayName.run({
    data: { displayName },
    auth: uid ? { uid } : null,
  } as unknown as Parameters<typeof updateDisplayName.run>[0]);

  beforeEach(async () => {
    await userRef.set({ displayName: 'Old Name', email: 'old@example.com' });
    await firestore.doc(`users/${profileUserId}/groups/${activeGroupId}`).set({ status: 'active' });
    await firestore.doc(`users/${profileUserId}/groups/${inactiveGroupId}`).set({ status: 'left' });
    await activeMembershipRef.set({ userId: profileUserId, displayNameSnapshot: 'Old Name', role: 'owner', status: 'active' });
    await inactiveMembershipRef.set({ userId: profileUserId, displayNameSnapshot: 'Old Name', role: 'member', status: 'left' });
    await historicMessageRef.set({ authorDisplayNameSnapshot: 'Old Name', text: 'Earlier message' });
  });

  afterEach(async () => {
    await Promise.all([
      userRef.delete(),
      firestore.doc(`users/${profileUserId}/groups/${activeGroupId}`).delete(),
      firestore.doc(`users/${profileUserId}/groups/${inactiveGroupId}`).delete(),
      activeMembershipRef.delete(),
      inactiveMembershipRef.delete(),
      historicMessageRef.delete(),
    ]);
  });

  it('updates the profile and active membership names without rewriting historical content', async () => {
    await expect(callUpdateDisplayName('  New Name  ')).resolves.toEqual({ displayName: 'New Name' });
    expect((await userRef.get()).data()).toMatchObject({ displayName: 'New Name', email: 'old@example.com' });
    expect((await activeMembershipRef.get()).data()).toMatchObject({ displayNameSnapshot: 'New Name', status: 'active' });
    expect((await inactiveMembershipRef.get()).data()).toMatchObject({ displayNameSnapshot: 'Old Name', status: 'left' });
    expect((await historicMessageRef.get()).data()).toMatchObject({ authorDisplayNameSnapshot: 'Old Name' });
  });

  it('rejects unauthenticated, blank, and overlong names without changing the profile', async () => {
    await expect(callUpdateDisplayName('New Name', null)).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(callUpdateDisplayName('   ')).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(callUpdateDisplayName('x'.repeat(121))).rejects.toMatchObject({ code: 'invalid-argument' });
    expect((await userRef.get()).data()?.displayName).toBe('Old Name');
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
      recommendationMessageId,
    });

    const recommendation = await firestore.doc(`groups/${recommendationGroupId}/messages/${recommendationMessageId}`).get();
    expect(recommendation.data()?.inboxRecipientIds).toContain(recipientId);

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

describe('setMovieSeenStatus callable', () => {
  const seenUserId = 'movie-seen-status-user';
  const firstGroupId = 'movie-seen-status-group-one';
  const secondGroupId = 'movie-seen-status-group-two';
  const canonicalMovieId = 'tmdb_603';
  const statusReference = firestore.doc(`users/${seenUserId}/movieSeenStatuses/${canonicalMovieId}`);

  const callSetStatus = (groupId: string, groupMovieId = canonicalMovieId, seen: unknown = true, uid: string | null = seenUserId) => setMovieSeenStatus.run({
    data: { groupId, groupMovieId, seen },
    auth: uid ? { uid } : null,
  } as unknown as Parameters<typeof setMovieSeenStatus.run>[0]);

  beforeAll(async () => {
    for (const groupId of [firstGroupId, secondGroupId]) {
      await firestore.doc(`groups/${groupId}`).set({ name: groupId });
      await firestore.doc(`groups/${groupId}/members/${seenUserId}`).set({ status: 'active' });
      await firestore.doc(`groups/${groupId}/groupMovies/${canonicalMovieId}`).set({
        provider: 'tmdb', externalMovieId: '603', title: 'The Matrix',
      });
    }
  });

  afterEach(async () => {
    await statusReference.delete();
  });

  afterAll(async () => {
    for (const groupId of [firstGroupId, secondGroupId]) {
      await firestore.doc(`groups/${groupId}/groupMovies/${canonicalMovieId}`).delete();
      await firestore.doc(`groups/${groupId}/groupMovies/wrong-key`).delete();
      await firestore.doc(`groups/${groupId}/members/${seenUserId}`).delete();
      await firestore.doc(`groups/${groupId}/members/inactive-seen-user`).delete();
      await firestore.doc(`groups/${groupId}`).delete();
    }
    await firestore.doc(`users/${seenUserId}`).delete();
  });

  it('persists the same personal status across groups for the canonical movie ID', async () => {
    await callSetStatus(firstGroupId, canonicalMovieId, true);
    expect((await statusReference.get()).data()).toMatchObject({ provider: 'tmdb', externalMovieId: '603', seen: true });

    await callSetStatus(secondGroupId, canonicalMovieId, false);
    expect((await statusReference.get()).data()).toMatchObject({ provider: 'tmdb', externalMovieId: '603', seen: false });
  });

  it('rejects unauthenticated requests, invalid status values, inactive members, and mismatched movie IDs', async () => {
    await expect(callSetStatus(firstGroupId, canonicalMovieId, true, null)).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(callSetStatus(firstGroupId, canonicalMovieId, 'yes')).rejects.toMatchObject({ code: 'invalid-argument' });

    await firestore.doc(`groups/${firstGroupId}/members/inactive-seen-user`).set({ status: 'left' });
    await expect(callSetStatus(firstGroupId, canonicalMovieId, true, 'inactive-seen-user')).rejects.toMatchObject({ code: 'permission-denied' });

    await firestore.doc(`groups/${firstGroupId}/groupMovies/wrong-key`).set({ provider: 'tmdb', externalMovieId: '603', title: 'The Matrix' });
    await expect(callSetStatus(firstGroupId, 'wrong-key', true)).rejects.toMatchObject({ code: 'failed-precondition' });
    expect((await statusReference.get()).exists).toBe(false);
  });

  it('rejects movies that are not present in the selected group', async () => {
    await expect(callSetStatus(firstGroupId, 'tmdb_550', true)).rejects.toMatchObject({ code: 'not-found' });
    expect((await statusReference.get()).exists).toBe(false);
  });
});

describe('deleteMovieRecommendation callable', () => {
  const deletionGroupId = 'recommendation-delete-group';
  const authorId = 'recommendation-delete-author';
  const otherAuthorId = 'recommendation-delete-other-author';
  const groupMovieId = 'tmdb_603';
  const firstMessageId = 'movie_author_first';
  const secondMessageId = 'movie_other_second';
  const groupRef = firestore.doc(`groups/${deletionGroupId}`);
  const movieRef = firestore.doc(`groups/${deletionGroupId}/groupMovies/${groupMovieId}`);
  const firstMessageRef = firestore.doc(`groups/${deletionGroupId}/messages/${firstMessageId}`);
  const secondMessageRef = firestore.doc(`groups/${deletionGroupId}/messages/${secondMessageId}`);
  const historyCollection = movieRef.collection('recommendations');
  const watchNotesCollection = movieRef.collection('watchNotes');

  const callDelete = (messageId: string, uid: string | null = authorId) => deleteMovieRecommendation.run({
    data: { groupId: deletionGroupId, messageId },
    auth: uid ? { uid } : null,
  } as unknown as Parameters<typeof deleteMovieRecommendation.run>[0]);

  const recommendationMessage = (author: string, messageId: string, timestamp: Date) => ({
    type: 'movie_recommendation',
    authorId: author,
    authorDisplayNameSnapshot: author,
    text: null,
    createdAt: timestamp,
    clientRequestId: messageId,
    movie: { provider: 'tmdb', externalMovieId: '603', title: 'The Matrix' },
    groupMovieId,
  });

  beforeEach(async () => {
    await groupRef.set({ name: 'Delete Test Group', lastActivityPreview: 'Recommended The Matrix' });
    await firestore.doc(`groups/${deletionGroupId}/members/${authorId}`).set({ status: 'active' });
    await firestore.doc(`groups/${deletionGroupId}/members/${otherAuthorId}`).set({ status: 'active' });
    await firestore.doc(`groups/${deletionGroupId}/members/${userId}`).set({ status: 'active' });
    await movieRef.set({
      provider: 'tmdb', externalMovieId: '603', title: 'The Matrix',
      recommendationCount: 2, recommenderIds: [authorId, otherAuthorId],
      firstRecommendedAt: new Date('2025-01-01T00:00:00.000Z'),
      firstRecommendationMessageId: firstMessageId,
      lastRecommendedAt: new Date('2025-01-02T00:00:00.000Z'),
      ratingCount: 1, ratingSum: 5, ratingAverage: 5,
    });
    await firstMessageRef.set(recommendationMessage(authorId, firstMessageId, new Date('2025-01-01T00:00:00.000Z')));
    await secondMessageRef.set(recommendationMessage(otherAuthorId, secondMessageId, new Date('2025-01-02T00:00:00.000Z')));
    await historyCollection.doc(firstMessageId).set({ messageId: firstMessageId, authorId, authorDisplayNameSnapshot: authorId, createdAt: new Date('2025-01-01T00:00:00.000Z') });
    await historyCollection.doc(secondMessageId).set({ messageId: secondMessageId, authorId: otherAuthorId, authorDisplayNameSnapshot: otherAuthorId, createdAt: new Date('2025-01-02T00:00:00.000Z') });
    await watchNotesCollection.doc('note-owner').set({ userId: 'note-owner', rating: 5, reviewText: 'Keep while another recommendation remains' });
    await firestore.doc(`users/${otherAuthorId}/receivedRecommendations/${firstMessageId}`).set({ recommendationMessageId: firstMessageId, groupId: deletionGroupId, seen: false });
  });

  afterEach(async () => {
    await groupRef.delete();
    await firestore.doc(`groups/${deletionGroupId}/members/${authorId}`).delete();
    await firestore.doc(`groups/${deletionGroupId}/members/${otherAuthorId}`).delete();
    await firestore.doc(`groups/${deletionGroupId}/members/${userId}`).delete();
    await firstMessageRef.delete();
    await secondMessageRef.delete();
    await firestore.doc(`groups/${deletionGroupId}/messages/not-a-recommendation`).delete();
    await movieRef.delete();
    const [history, notes] = await Promise.all([historyCollection.get(), watchNotesCollection.get()]);
    await Promise.all([...history.docs, ...notes.docs].map((item) => item.ref.delete()));
    await firestore.doc(`users/${otherAuthorId}/receivedRecommendations/${firstMessageId}`).delete();
    await firestore.doc(`users/${otherAuthorId}/receivedRecommendations/${secondMessageId}`).delete();
  });

  it('deletes only the authored recommendation and keeps the group movie while another recommendation remains', async () => {
    await firestore.doc(`groups/${deletionGroupId}/members/${otherAuthorId}`).update({ status: 'left' });
    await expect(callDelete(firstMessageId)).resolves.toMatchObject({ deleted: true, movieRemoved: false });
    expect((await firstMessageRef.get()).exists).toBe(false);
    expect((await historyCollection.doc(firstMessageId).get()).exists).toBe(false);
    expect((await secondMessageRef.get()).exists).toBe(true);
    expect((await movieRef.get()).data()).toMatchObject({
      recommendationCount: 1,
      recommenderIds: [otherAuthorId],
      firstRecommendationMessageId: secondMessageId,
      ratingCount: 1,
      ratingSum: 5,
    });
    expect((await watchNotesCollection.doc('note-owner').get()).exists).toBe(true);
    expect((await firestore.doc(`users/${otherAuthorId}/receivedRecommendations/${firstMessageId}`).get()).exists).toBe(false);
  });

  it('removes the group movie and nested watch notes when the last recommendation is deleted', async () => {
    await secondMessageRef.delete();
    await historyCollection.doc(secondMessageId).delete();
    await movieRef.update({ recommendationCount: 1, recommenderIds: [authorId] });

    await expect(callDelete(firstMessageId)).resolves.toMatchObject({ deleted: true, movieRemoved: true });
    expect((await movieRef.get()).exists).toBe(false);
    expect((await watchNotesCollection.doc('note-owner').get()).exists).toBe(false);
    expect((await firstMessageRef.get()).exists).toBe(false);
  });

  it('rejects unauthenticated and non-author delete attempts without changing data', async () => {
    await expect(callDelete(firstMessageId, null)).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(callDelete(secondMessageId)).rejects.toMatchObject({ code: 'permission-denied' });
    await firestore.doc(`groups/${deletionGroupId}/messages/not-a-recommendation`).set({ type: 'text', authorId });
    await expect(callDelete('not-a-recommendation')).rejects.toMatchObject({ code: 'permission-denied' });
    await firestore.doc(`groups/${deletionGroupId}/members/${authorId}`).update({ status: 'left' });
    await expect(callDelete(firstMessageId)).rejects.toMatchObject({ code: 'permission-denied' });
    expect((await firstMessageRef.get()).exists).toBe(true);
    expect((await secondMessageRef.get()).exists).toBe(true);
  });

  it('handles concurrent duplicate deletion requests idempotently', async () => {
    const results = await Promise.all([callDelete(firstMessageId), callDelete(firstMessageId)]);
    expect(results.filter((result) => result.deleted)).toHaveLength(1);
    expect((await movieRef.get()).data()?.recommendationCount).toBe(1);
    expect((await firstMessageRef.get()).exists).toBe(false);
  });

  it('does not leave a watch note orphaned when its save races with deleting the last recommendation', async () => {
    await secondMessageRef.delete();
    await historyCollection.doc(secondMessageId).delete();
    await movieRef.update({ recommendationCount: 1, recommenderIds: [authorId] });

    await Promise.allSettled([
      callDelete(firstMessageId),
      callSaveWatchNote({ groupId: deletionGroupId, groupMovieId, rating: null, reviewText: 'Concurrent note', watchedOn: '' }),
    ]);

    expect((await movieRef.get()).exists).toBe(false);
    expect((await watchNotesCollection.doc(userId).get()).exists).toBe(false);
    expect((await firstMessageRef.get()).exists).toBe(false);
  });
});