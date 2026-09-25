import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';

let testEnvironment: RulesTestEnvironment;

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId: 'demo-filmchat',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

it('denies unauthenticated Firestore reads and writes by default', async () => {
  const db = testEnvironment.unauthenticatedContext().firestore();

  await expect(db.doc('environment/check').get()).rejects.toThrow();
  await expect(db.doc('environment/check').set({ ready: true })).rejects.toThrow();
});

it('allows a user to create their profile but not another user profile', async () => {
  const user = testEnvironment.authenticatedContext('user-1', { email: 'one@example.com' }).firestore();
  const otherUser = testEnvironment.authenticatedContext('user-2', { email: 'two@example.com' }).firestore();

  await user.doc('users/user-1').set({
    email: 'one@example.com', displayName: 'One', createdAt: new Date(), updatedAt: new Date(),
  });
  await expect(otherUser.doc('users/user-1').set({
    email: 'one@example.com', displayName: 'Changed', createdAt: new Date(), updatedAt: new Date(),
  })).rejects.toThrow();
});

it('creates an owner group atomically and hides it from another user', async () => {
  const owner = testEnvironment.authenticatedContext('owner', { email: 'owner@example.com' }).firestore();
  const stranger = testEnvironment.authenticatedContext('stranger', { email: 'stranger@example.com' }).firestore();
  const batch = owner.batch();

  batch.set(owner.doc('groups/group-1'), { name: 'Friday Films', ownerId: 'owner', createdAt: new Date(), updatedAt: new Date() });
  batch.set(owner.doc('groups/group-1/members/owner'), {
    userId: 'owner', role: 'owner', status: 'active', joinedAt: new Date(), updatedAt: new Date(),
  });
  batch.set(owner.doc('users/owner/groups/group-1'), { groupId: 'group-1', status: 'active', updatedAt: new Date() });
  await batch.commit();

  await expect(owner.doc('groups/group-1').get()).resolves.toBeDefined();
  await expect(stranger.doc('groups/group-1').get()).rejects.toThrow();
  await expect(owner.doc('groups/group-1/members/owner').update({ status: 'left' })).rejects.toThrow();
  await expect(owner.doc('groups/group-1/members/stranger').set({
    userId: 'stranger', role: 'member', status: 'active',
  })).rejects.toThrow();
  await expect(owner.doc('invites/invite-1').set({
    groupId: 'group-1', tokenHash: 'secret', status: 'active',
  })).rejects.toThrow();
  await expect(owner.doc('invites/invite-1').get()).rejects.toThrow();
});

it('allows active members to create text messages and rejects invalid authors', async () => {
  const owner = testEnvironment.authenticatedContext('owner', { email: 'owner@example.com' }).firestore();
  const stranger = testEnvironment.authenticatedContext('stranger', { email: 'stranger@example.com' }).firestore();
  const message = {
    type: 'text',
    authorId: 'owner',
    authorDisplayNameSnapshot: 'Owner',
    text: 'Hello from the group',
    createdAt: new Date(),
    clientRequestId: 'request-1',
  };

  await expect(owner.doc('groups/group-1/messages/text_request-1').set(message)).resolves.toBeUndefined();
  await expect(stranger.doc('groups/group-1/messages/text_request-2').set({ ...message, authorId: 'stranger' })).rejects.toThrow();
  await expect(owner.doc('groups/group-1/messages/text-invalid').set({ ...message, type: 'movie_recommendation' })).rejects.toThrow();
  await expect(owner.doc('groups/group-1/messages/text-empty').set({ ...message, text: '   ' })).rejects.toThrow();
  await expect(owner.doc('groups/group-1/messages/text_request-1').update({ text: 'Changed' })).rejects.toThrow();
  await expect(owner.doc('groups/group-1/messages/text_request-1').get()).resolves.toBeDefined();
});

it('allows active members to read movie history but denies client movie writes', async () => {
  const owner = testEnvironment.authenticatedContext('owner', { email: 'owner@example.com' }).firestore();
  const stranger = testEnvironment.authenticatedContext('stranger', { email: 'stranger@example.com' }).firestore();
  const movie = {
    provider: 'tmdb',
    externalMovieId: '603',
    title: 'The Matrix',
    recommendationCount: 1,
    lastRecommendedAt: new Date(),
  };

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('groups/group-1/groupMovies/tmdb_603').set(movie);
    await context.firestore().doc('groups/group-1/groupMovies/tmdb_603/recommendations/movie_request-1').set({
      messageId: 'movie_request-1',
      authorId: 'owner',
      authorDisplayNameSnapshot: 'Owner',
      note: 'A classic',
      createdAt: new Date(),
    });
  });

  await expect(owner.doc('groups/group-1/groupMovies/tmdb_603').get()).resolves.toBeDefined();
  await expect(owner.doc('groups/group-1/groupMovies/tmdb_603/recommendations/movie_request-1').get()).resolves.toBeDefined();
  await expect(stranger.doc('groups/group-1/groupMovies/tmdb_603').get()).rejects.toThrow();
  await expect(owner.doc('groups/group-1/groupMovies/tmdb_603').set(movie)).rejects.toThrow();
  await expect(owner.doc('groups/group-1/groupMovies/tmdb_603/recommendations/movie_request-2').set({
    messageId: 'movie_request-2',
    authorId: 'owner',
  })).rejects.toThrow();
});
