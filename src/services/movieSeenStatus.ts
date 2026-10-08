import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';

export type MovieSeenStatus = {
  seen: boolean;
};

const movieSeenStatusDocument = (userId: string, groupMovieId: string) =>
  doc(db, 'users', userId, 'movieSeenStatuses', groupMovieId);

export const subscribeToMovieSeenStatus = (
  userId: string,
  groupMovieId: string,
  onStatus: (status: MovieSeenStatus) => void,
  onError: (error: Error) => void,
): Unsubscribe => onSnapshot(
  movieSeenStatusDocument(userId, groupMovieId),
  (snapshot) => onStatus({ seen: snapshot.exists() && snapshot.data().seen === true }),
  onError,
);

export const setMovieSeenStatus = async (groupId: string, groupMovieId: string, seen: boolean) => {
  const callable = httpsCallable<
    { groupId: string; groupMovieId: string; seen: boolean },
    { groupId: string; groupMovieId: string; seen: boolean }
  >(functions, 'setMovieSeenStatus');
  const response = await callable({ groupId, groupMovieId, seen });
  return response.data;
};