import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';

export type GroupMovie = {
  id: string;
  provider: 'tmdb';
  externalMovieId: string;
  title: string;
  releaseYear: number | null;
  posterPath: string | null;
  overview: string | null;
  firstRecommendedAt: Timestamp | null;
  lastRecommendedAt: Timestamp | null;
  firstRecommendationMessageId: string;
  recommendationCount: number;
  recommenderIds: string[];
  ratingCount: number;
  ratingSum: number;
  ratingAverage: number | null;
  updatedAt: Timestamp | null;
};

export type RecommendationHistoryItem = {
  id: string;
  messageId: string;
  authorId: string;
  authorDisplayNameSnapshot: string;
  note: string | null;
  createdAt: Timestamp | null;
};

const groupMoviesCollection = (groupId: string) => collection(db, 'groups', groupId, 'groupMovies');
const groupMovieDocument = (groupId: string, groupMovieId: string) => doc(groupMoviesCollection(groupId), groupMovieId);
const historyCollection = (groupId: string, groupMovieId: string) => collection(groupMovieDocument(groupId, groupMovieId), 'recommendations');

const nullableString = (value: unknown) => typeof value === 'string' ? value : null;
const timestamp = (value: unknown) => value && typeof value === 'object' && 'toMillis' in value ? value as Timestamp : null;
const boundedNumber = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const toGroupMovie = (snapshot: { id: string; data: () => DocumentData }): GroupMovie | null => {
  const data = snapshot.data();
  if (data.provider !== 'tmdb' || typeof data.externalMovieId !== 'string' || typeof data.title !== 'string') return null;
  return {
    id: snapshot.id,
    provider: 'tmdb',
    externalMovieId: data.externalMovieId,
    title: data.title,
    releaseYear: typeof data.releaseYear === 'number' ? data.releaseYear : null,
    posterPath: nullableString(data.posterPath),
    overview: nullableString(data.overview),
    firstRecommendedAt: timestamp(data.firstRecommendedAt),
    lastRecommendedAt: timestamp(data.lastRecommendedAt),
    firstRecommendationMessageId: typeof data.firstRecommendationMessageId === 'string' ? data.firstRecommendationMessageId : '',
    recommendationCount: boundedNumber(data.recommendationCount, 0),
    recommenderIds: Array.isArray(data.recommenderIds) ? data.recommenderIds.filter((value): value is string => typeof value === 'string') : [],
    ratingCount: boundedNumber(data.ratingCount, 0),
    ratingSum: boundedNumber(data.ratingSum, 0),
    ratingAverage: typeof data.ratingAverage === 'number' ? data.ratingAverage : null,
    updatedAt: timestamp(data.updatedAt),
  };
};

const toRecommendationHistory = (snapshot: { id: string; data: () => DocumentData }): RecommendationHistoryItem | null => {
  const data = snapshot.data();
  if (typeof data.messageId !== 'string' || typeof data.authorId !== 'string' || typeof data.authorDisplayNameSnapshot !== 'string') return null;
  return {
    id: snapshot.id,
    messageId: data.messageId,
    authorId: data.authorId,
    authorDisplayNameSnapshot: data.authorDisplayNameSnapshot,
    note: nullableString(data.note),
    createdAt: timestamp(data.createdAt),
  };
};

export const subscribeToGroupMovies = (
  groupId: string,
  onMovies: (movies: GroupMovie[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => onSnapshot(
  query(groupMoviesCollection(groupId), orderBy('lastRecommendedAt', 'desc')),
  (snapshot) => onMovies(snapshot.docs.map(toGroupMovie).filter((movie): movie is GroupMovie => movie !== null)),
  (error) => onError(error),
);

export const loadGroupMovie = async (groupId: string, groupMovieId: string) => {
  const snapshot = await getDoc(groupMovieDocument(groupId, groupMovieId));
  return snapshot.exists() ? toGroupMovie(snapshot) : null;
};

export const loadRecommendationHistory = async (groupId: string, groupMovieId: string): Promise<RecommendationHistoryItem[]> => {
  const snapshot = await getDocs(query(historyCollection(groupId, groupMovieId), orderBy('createdAt', 'desc'), limit(100)));
  return snapshot.docs.map(toRecommendationHistory).filter((item): item is RecommendationHistoryItem => item !== null);
};
