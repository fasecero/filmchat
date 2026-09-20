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
