import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { createClientRequestId, MAX_RECOMMENDATION_NOTE_LENGTH, type MovieCatalogResult } from './messages';

export const searchMovies = async (query: string): Promise<MovieCatalogResult[]> => {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2 || normalizedQuery.length > 100) {
    throw new Error('Search query must be between 2 and 100 characters.');
  }
  const callable = httpsCallable<{ query: string }, { results: MovieCatalogResult[] }>(functions, 'searchMovies');
  const response = await callable({ query: normalizedQuery });
  return response.data.results;
};

export const recommendMovie = async (
  groupId: string,
  movie: MovieCatalogResult,
  note: string,
  clientRequestId = createClientRequestId(),
) => {
  const normalizedNote = note.trim();
  if (normalizedNote.length > MAX_RECOMMENDATION_NOTE_LENGTH) {
    throw new Error(`Recommendation note must be ${MAX_RECOMMENDATION_NOTE_LENGTH} characters or fewer.`);
  }
  const callable = httpsCallable<{
    groupId: string;
    externalMovieId: string;
    note: string;
    clientRequestId: string;
  }, {
    messageId: string;
    clientRequestId: string;
    movie: MovieCatalogResult;
    groupMovieId: string;
    note: string | null;
  }>(functions, 'recommendMovie');
  const response = await callable({
    groupId,
    externalMovieId: movie.externalMovieId,
    note: normalizedNote,
    clientRequestId,
  });
  return response.data;
};
