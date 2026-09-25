import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) initializeApp();

export async function seedGroupMovieForIntegration(groupId: string, groupMovieId: string) {
  await getFirestore().doc(`groups/${groupId}/groupMovies/${groupMovieId}`).set({
    provider: 'tmdb',
    externalMovieId: '603',
    title: 'The Matrix',
    releaseYear: 1999,
    posterPath: null,
    overview: 'A test movie.',
    firstRecommendedAt: new Date(),
    lastRecommendedAt: new Date(),
    firstRecommendationMessageId: 'integration-seed',
    recommendationCount: 1,
    recommenderIds: ['alice'],
    ratingCount: 0,
    ratingSum: 0,
    ratingAverage: null,
    updatedAt: new Date(),
  });
}

export async function closeIntegrationFirestore() {
	await getFirestore().terminate();
}
