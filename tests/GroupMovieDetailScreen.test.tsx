import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { GroupMovieDetailScreen } from '../src/screens/groups/GroupMovieDetailScreen';
import { GroupMoviesScreen } from '../src/screens/groups/GroupMoviesScreen';
import {
  loadRecommendationHistory,
  removeWatchNote,
  saveWatchNote,
  subscribeToGroupMovie,
  subscribeToGroupMovies,
  subscribeToWatchNotes,
  type GroupMovie,
  type WatchNote,
} from '../src/services/groupMovies';

type MovieCallback = (movie: GroupMovie | null) => void;
type MoviesCallback = (movies: GroupMovie[]) => void;
type NotesCallback = (notes: WatchNote[]) => void;

const movieSubscriptions: { groupId: string; groupMovieId: string; onMovie: MovieCallback; unsubscribe: jest.Mock }[] = [];
const moviesSubscriptions: { groupId: string; onMovies: MoviesCallback; unsubscribe: jest.Mock }[] = [];
const noteSubscriptions: { groupId: string; groupMovieId: string; onNotes: NotesCallback; unsubscribe: jest.Mock }[] = [];

jest.mock('../src/services/groupMovies', () => ({
  loadRecommendationHistory: jest.fn(),
  removeWatchNote: jest.fn(),
  saveWatchNote: jest.fn(),
  subscribeToGroupMovie: jest.fn(),
  subscribeToGroupMovies: jest.fn(),
  subscribeToWatchNotes: jest.fn(),
  MAX_WATCH_NOTE_PLATFORM_LENGTH: 80,
  MAX_WATCH_NOTE_REVIEW_LENGTH: 1000,
}));

const movie = (ratingCount = 0, ratingAverage: number | null = null): GroupMovie => ({
  id: 'tmdb_603', provider: 'tmdb', externalMovieId: '603', title: 'The Matrix', releaseYear: 1999,
  posterPath: null, overview: null, firstRecommendedAt: null, lastRecommendedAt: null,
  firstRecommendationMessageId: 'message-1', recommendationCount: 1, recommenderIds: ['viewer'],
  ratingCount, ratingSum: ratingAverage === null ? 0 : ratingCount * ratingAverage, ratingAverage, updatedAt: null,
});

const watchNote = (userId: string, rating: number, reviewText: string): WatchNote => ({
  id: userId, userId, displayNameSnapshot: userId === 'viewer' ? 'Viewer' : 'Member', rating,
  reviewText, watchedOn: 'Cinema', createdAt: null, updatedAt: null,
});

const finishInitialLoad = () => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
});

beforeEach(() => {
  movieSubscriptions.length = 0;
  moviesSubscriptions.length = 0;
  noteSubscriptions.length = 0;
  jest.clearAllMocks();
  jest.mocked(loadRecommendationHistory).mockResolvedValue([]);
  jest.mocked(saveWatchNote).mockResolvedValue({ groupId: 'group-1', groupMovieId: 'tmdb_603', removed: false });
  jest.mocked(removeWatchNote).mockResolvedValue({ groupId: 'group-1', groupMovieId: 'tmdb_603', removed: true });
  jest.mocked(subscribeToGroupMovie).mockImplementation((groupId, groupMovieId, onMovie) => {
    const unsubscribe = jest.fn();
    movieSubscriptions.push({ groupId, groupMovieId, onMovie, unsubscribe });
    return unsubscribe;
  });
  jest.mocked(subscribeToGroupMovies).mockImplementation((groupId, onMovies) => {
    const unsubscribe = jest.fn();
    moviesSubscriptions.push({ groupId, onMovies, unsubscribe });
    return unsubscribe;
  });
  jest.mocked(subscribeToWatchNotes).mockImplementation((groupId, groupMovieId, onNotes) => {
    const unsubscribe = jest.fn();
    noteSubscriptions.push({ groupId, groupMovieId, onNotes, unsubscribe });
    return unsubscribe;
  });
});

describe('GroupMovieDetailScreen realtime watch notes', () => {
  it('reflects note creation, update, removal, and aggregate-rating updates', async () => {
    render(<GroupMovieDetailScreen groupId="group-1" groupMovieId="tmdb_603" userId="viewer" onBack={jest.fn()} />);
    await finishInitialLoad();
    expect(screen.getByText(/This product uses the TMDB API but is not endorsed or certified by TMDB/)).toBeOnTheScreen();
    const movieListener = movieSubscriptions[0].onMovie;
    const notesListener = noteSubscriptions[0].onNotes;

    act(() => {
      movieListener(movie());
      notesListener([]);
    });
    expect(screen.getByText('No member notes yet.')).toBeOnTheScreen();

    act(() => {
      movieListener(movie(1, 5));
      notesListener([watchNote('viewer', 5, 'Excellent first watch')]);
    });
    expect(screen.getAllByText('Excellent first watch')).toHaveLength(2);
    expect(screen.getByText('5.0 average from 1 rating')).toBeOnTheScreen();

    act(() => {
      movieListener(movie(1, 3));
      notesListener([watchNote('viewer', 3, 'Updated after a rewatch')]);
    });
    expect(screen.getAllByText('Updated after a rewatch')).toHaveLength(2);
    expect(screen.getByText('3.0 average from 1 rating')).toBeOnTheScreen();
    expect(screen.queryByText('Excellent first watch')).toBeNull();

    act(() => {
      movieListener(movie());
      notesListener([]);
    });
    expect(screen.getByText('No member notes yet.')).toBeOnTheScreen();
    expect(screen.getByText('No rating')).toBeOnTheScreen();
    expect(screen.queryByText('Updated after a rewatch')).toBeNull();
  });

  it('keeps an in-progress edit when another watch-note snapshot arrives', async () => {
    render(<GroupMovieDetailScreen groupId="group-1" groupMovieId="tmdb_603" userId="viewer" onBack={jest.fn()} />);
    await finishInitialLoad();
    act(() => {
      movieSubscriptions[0].onMovie(movie());
      noteSubscriptions[0].onNotes([watchNote('viewer', 4, 'Current review')]);
    });

    fireEvent.press(screen.getByText('Edit'));
    fireEvent.changeText(screen.getByPlaceholderText('Short review'), 'My unsaved draft');
    act(() => noteSubscriptions[0].onNotes([
      watchNote('viewer', 4, 'Current review'),
      watchNote('another-member', 2, 'A separate member note'),
    ]));

    expect(screen.getByPlaceholderText('Short review').props.value).toBe('My unsaved draft');
    expect(screen.getByText('A separate member note')).toBeOnTheScreen();
  });

  it('unsubscribes on group/movie changes and ignores callbacks from the old scope', async () => {
    const view = render(<GroupMovieDetailScreen groupId="group-1" groupMovieId="tmdb_603" userId="viewer" onBack={jest.fn()} />);
    await finishInitialLoad();
    const oldMovieSubscription = movieSubscriptions[0];
    const oldNotesSubscription = noteSubscriptions[0];
    act(() => {
      oldMovieSubscription.onMovie(movie());
      oldNotesSubscription.onNotes([]);
    });

    view.rerender(<GroupMovieDetailScreen groupId="group-2" groupMovieId="tmdb_550" userId="viewer" onBack={jest.fn()} />);
    await finishInitialLoad();
    expect(oldMovieSubscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(oldNotesSubscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(movieSubscriptions[1]).toMatchObject({ groupId: 'group-2', groupMovieId: 'tmdb_550' });
    expect(noteSubscriptions[1]).toMatchObject({ groupId: 'group-2', groupMovieId: 'tmdb_550' });

    act(() => oldNotesSubscription.onNotes([watchNote('other', 3, 'Stale note from previous group')]));
    expect(screen.queryByText('Stale note from previous group')).toBeNull();

    act(() => {
      movieSubscriptions[1].onMovie({ ...movie(), id: 'tmdb_550', title: 'Fight Club' });
      noteSubscriptions[1].onNotes([watchNote('other', 3, 'New group note')]);
    });
    expect(screen.getByText('Fight Club (1999)')).toBeOnTheScreen();
    expect(screen.getByText('New group note')).toBeOnTheScreen();

    view.unmount();
    expect(movieSubscriptions[1].unsubscribe).toHaveBeenCalledTimes(1);
    expect(noteSubscriptions[1].unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('GroupMoviesScreen realtime rating aggregates', () => {
  it('reflects rating creation, updates, and removal in the movie list', () => {
    render(<GroupMoviesScreen groupId="group-1" onBack={jest.fn()} onSelect={jest.fn()} />);
    expect(screen.getByText(/This product uses the TMDB API but is not endorsed or certified by TMDB/)).toBeOnTheScreen();
    const onMovies = moviesSubscriptions[0].onMovies;

    act(() => onMovies([movie()]));
    expect(screen.getByText('1 recommendation')).toBeOnTheScreen();
    expect(screen.queryByText(/average from/)).toBeNull();

    act(() => onMovies([movie(1, 5)]));
    expect(screen.getByText('5.0 average from 1')).toBeOnTheScreen();

    act(() => onMovies([movie(1, 3)]));
    expect(screen.getByText('3.0 average from 1')).toBeOnTheScreen();
    expect(screen.queryByText('5.0 average from 1')).toBeNull();

    act(() => onMovies([movie()]));
    expect(screen.queryByText(/average from/)).toBeNull();
  });
});
