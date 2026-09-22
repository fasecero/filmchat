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
});
