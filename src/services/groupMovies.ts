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
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';

export const MAX_WATCH_NOTE_REVIEW_LENGTH = 1000;
export const MAX_WATCH_NOTE_PLATFORM_LENGTH = 80;

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

export type WatchNote = {
  id: string;
  userId: string;
  displayNameSnapshot: string;
  rating: number | null;
  reviewText: string | null;
  watchedOn: string | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

const groupMoviesCollection = (groupId: string) => collection(db, 'groups', groupId, 'groupMovies');
const groupMovieDocument = (groupId: string, groupMovieId: string) => doc(groupMoviesCollection(groupId), groupMovieId);
const historyCollection = (groupId: string, groupMovieId: string) => collection(groupMovieDocument(groupId, groupMovieId), 'recommendations');
const watchNotesCollection = (groupId: string, groupMovieId: string) => collection(groupMovieDocument(groupId, groupMovieId), 'watchNotes');

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

const toWatchNote = (snapshot: { id: string; data: () => DocumentData }): WatchNote | null => {
  const data = snapshot.data();
  if (typeof data.userId !== 'string') return null;
  return {
    id: snapshot.id,
    userId: data.userId,
    displayNameSnapshot: typeof data.displayNameSnapshot === 'string' ? data.displayNameSnapshot : 'Member',
    rating: typeof data.rating === 'number' ? data.rating : null,
    reviewText: nullableString(data.reviewText),
    watchedOn: nullableString(data.watchedOn),
    createdAt: timestamp(data.createdAt),
    updatedAt: timestamp(data.updatedAt),
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

export const subscribeToGroupMovie = (
  groupId: string,
  groupMovieId: string,
  onMovie: (movie: GroupMovie | null) => void,
  onError: (error: Error) => void,
): Unsubscribe => onSnapshot(
  groupMovieDocument(groupId, groupMovieId),
  (snapshot) => onMovie(snapshot.exists() ? toGroupMovie(snapshot) : null),
  (error) => onError(error),
);

export const loadRecommendationHistory = async (groupId: string, groupMovieId: string): Promise<RecommendationHistoryItem[]> => {
  const snapshot = await getDocs(query(historyCollection(groupId, groupMovieId), orderBy('createdAt', 'desc'), limit(100)));
  return snapshot.docs.map(toRecommendationHistory).filter((item): item is RecommendationHistoryItem => item !== null);
};

export const loadWatchNotes = async (groupId: string, groupMovieId: string): Promise<WatchNote[]> => {
  const snapshot = await getDocs(query(watchNotesCollection(groupId, groupMovieId), orderBy('updatedAt', 'desc'), limit(100)));
  return snapshot.docs.map(toWatchNote).filter((item): item is WatchNote => item !== null);
};

export const subscribeToWatchNotes = (
  groupId: string,
  groupMovieId: string,
  onNotes: (notes: WatchNote[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => onSnapshot(
  query(watchNotesCollection(groupId, groupMovieId), orderBy('updatedAt', 'desc'), limit(100)),
  (snapshot) => onNotes(snapshot.docs.map(toWatchNote).filter((item): item is WatchNote => item !== null)),
  (error) => onError(error),
);

export const saveWatchNote = async (
  groupId: string,
  groupMovieId: string,
  note: { rating: number | null; reviewText: string; watchedOn: string },
) => {
  const callable = httpsCallable<typeof note & { groupId: string; groupMovieId: string }, { groupId: string; groupMovieId: string; removed: boolean }>(functions, 'saveWatchNote');
  const response = await callable({ groupId, groupMovieId, ...note });
  return response.data;
};

export const removeWatchNote = async (groupId: string, groupMovieId: string) => {
  const callable = httpsCallable<{ groupId: string; groupMovieId: string; remove: true }, { groupId: string; groupMovieId: string; removed: boolean }>(functions, 'saveWatchNote');
  const response = await callable({ groupId, groupMovieId, remove: true });
  return response.data;
};
