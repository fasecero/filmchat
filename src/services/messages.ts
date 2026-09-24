import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';

export const MAX_MESSAGE_LENGTH = 2000;
export const MESSAGE_PAGE_SIZE = 50;
export const MAX_RECOMMENDATION_NOTE_LENGTH = 500;

export type TextMessage = {
  id: string;
  type: 'text';
  authorId: string;
  authorDisplayNameSnapshot: string;
  text: string;
  createdAt: Timestamp | null;
  clientRequestId: string;
};

export type MovieCatalogResult = {
  provider: 'tmdb';
  externalMovieId: string;
  title: string;
  releaseYear: number | null;
  posterPath: string | null;
  overview: string | null;
};

export type MovieRecommendationMessage = {
  id: string;
  type: 'movie_recommendation';
  authorId: string;
  authorDisplayNameSnapshot: string;
  text: string | null;
  createdAt: Timestamp | null;
  clientRequestId: string;
  movie: MovieCatalogResult;
  groupMovieId: string;
};

export type Message = TextMessage | MovieRecommendationMessage;

export type MessagePage = {
  messages: Message[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
};

export const normalizeMessageText = (value: string) => {
  const text = value.trim();
  if (!text || text.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message must be between 1 and ${MAX_MESSAGE_LENGTH} characters.`);
  }
  return text;
};

export const createClientRequestId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const messagesCollection = (groupId: string) => collection(db, 'groups', groupId, 'messages');

const toMessage = (snapshot: QueryDocumentSnapshot<DocumentData>): Message => {
  const data = snapshot.data();
  if (data.type === 'movie_recommendation' && data.movie?.provider === 'tmdb' && typeof data.movie.externalMovieId === 'string' && typeof data.movie.title === 'string' && typeof data.groupMovieId === 'string') {
    return {
      id: snapshot.id,
      type: 'movie_recommendation',
      authorId: data.authorId as string,
      authorDisplayNameSnapshot: data.authorDisplayNameSnapshot as string,
      text: typeof data.text === 'string' ? data.text : null,
      createdAt: (data.createdAt as Timestamp | undefined) ?? null,
      clientRequestId: data.clientRequestId as string,
      movie: {
        provider: 'tmdb',
        externalMovieId: data.movie.externalMovieId,
        title: data.movie.title,
        releaseYear: typeof data.movie.releaseYear === 'number' ? data.movie.releaseYear : null,
        posterPath: typeof data.movie.posterPath === 'string' ? data.movie.posterPath : null,
        overview: typeof data.movie.overview === 'string' ? data.movie.overview : null,
      },
      groupMovieId: data.groupMovieId,
    };
  }
  return {
    id: snapshot.id,
    type: 'text',
    authorId: data.authorId as string,
    authorDisplayNameSnapshot: data.authorDisplayNameSnapshot as string,
    text: data.text as string,
    createdAt: (data.createdAt as Timestamp | undefined) ?? null,
    clientRequestId: data.clientRequestId as string,
  };
};

const sortMessages = (messages: Message[]) => [...messages].sort((left, right) => {
  const leftTime = left.createdAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
  const rightTime = right.createdAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
  return leftTime - rightTime || left.id.localeCompare(right.id);
});

export const subscribeToLatestMessages = (
  groupId: string,
  onMessages: (messages: Message[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => onSnapshot(
  query(messagesCollection(groupId), orderBy('createdAt', 'desc'), limit(MESSAGE_PAGE_SIZE)),
  (snapshot) => onMessages(sortMessages(snapshot.docs.map(toMessage))),
  (error) => onError(error),
);

export const loadOlderMessages = async (
  groupId: string,
  cursor: QueryDocumentSnapshot<DocumentData> | null,
): Promise<MessagePage> => {
  const baseQuery = query(messagesCollection(groupId), orderBy('createdAt', 'desc'), limit(MESSAGE_PAGE_SIZE));
  const pageQuery = cursor
    ? query(messagesCollection(groupId), orderBy('createdAt', 'desc'), startAfter(cursor), limit(MESSAGE_PAGE_SIZE))
    : baseQuery;
  const snapshot = await getDocs(pageQuery);
  return {
    messages: sortMessages(snapshot.docs.map(toMessage)),
    cursor: snapshot.docs.at(-1) ?? cursor,
    hasMore: snapshot.docs.length === MESSAGE_PAGE_SIZE,
  };
};

export const sendTextMessage = async (
  groupId: string,
  authorId: string,
  authorDisplayNameSnapshot: string,
  text: string,
  clientRequestId = createClientRequestId(),
) => {
  const normalizedText = normalizeMessageText(text);
  const messageId = `text_${clientRequestId}`;
  await setDoc(doc(messagesCollection(groupId), messageId), {
    type: 'text',
    authorId,
    authorDisplayNameSnapshot,
    text: normalizedText,
    createdAt: serverTimestamp(),
    clientRequestId,
  });
  return { messageId, clientRequestId, text: normalizedText };
};