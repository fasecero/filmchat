import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';
import { GroupDetailScreen } from '../src/screens/groups/GroupDetailScreen';
import { GroupMovieDetailScreen } from '../src/screens/groups/GroupMovieDetailScreen';
import { GroupMoviesScreen } from '../src/screens/groups/GroupMoviesScreen';
import {
  enrichGroupMovieMetadata,
  loadRecommendationHistory,
  removeWatchNote,
  saveWatchNote,
  subscribeToGroupMovie,
  subscribeToGroupMovies,
  subscribeToWatchNotes,
  type GroupMovie,
  type RecommendationHistoryItem,
  type WatchNote,
} from '../src/services/groupMovies';
import { setMovieSeenStatus, subscribeToMovieSeenStatus } from '../src/services/movieSeenStatus';
import { listActiveGroupMembers } from '../src/services/groups';
import {
  deleteMovieRecommendation,
  loadOlderMessages,
  subscribeToLatestMessages,
  type Message,
} from '../src/services/messages';

type MovieCallback = (movie: GroupMovie | null) => void;
type MoviesCallback = (movies: GroupMovie[]) => void;
type NotesCallback = (notes: WatchNote[]) => void;
type SeenCallback = (status: { seen: boolean }) => void;

const movieSubscriptions: { groupId: string; groupMovieId: string; onMovie: MovieCallback; unsubscribe: jest.Mock }[] = [];
const moviesSubscriptions: { groupId: string; onMovies: MoviesCallback; unsubscribe: jest.Mock }[] = [];
const noteSubscriptions: { groupId: string; groupMovieId: string; onNotes: NotesCallback; unsubscribe: jest.Mock }[] = [];
const seenSubscriptions: { userId: string; groupMovieId: string; onStatus: SeenCallback; unsubscribe: jest.Mock }[] = [];
const messageSubscriptions: { groupId: string; onMessages: (messages: Message[]) => void; unsubscribe: jest.Mock }[] = [];

jest.mock('../src/services/auth', () => ({
  signOutUser: jest.fn(),
}));

jest.mock('../src/services/invites', () => ({
  buildInviteLink: jest.fn(),
  createInvite: jest.fn(),
  leaveGroup: jest.fn(),
}));

jest.mock('../src/services/movies', () => ({
  searchMovies: jest.fn(),
  recommendMovie: jest.fn(),
}));

jest.mock('../src/services/groupMovies', () => ({
  enrichGroupMovieMetadata: jest.fn(),
  loadRecommendationHistory: jest.fn(),
  removeWatchNote: jest.fn(),
  saveWatchNote: jest.fn(),
  subscribeToGroupMovie: jest.fn(),
  subscribeToGroupMovies: jest.fn(),
  subscribeToWatchNotes: jest.fn(),
  MAX_WATCH_NOTE_PLATFORM_LENGTH: 80,
  MAX_WATCH_NOTE_REVIEW_LENGTH: 1000,
}));

jest.mock('../src/services/movieSeenStatus', () => ({
  setMovieSeenStatus: jest.fn(),
  subscribeToMovieSeenStatus: jest.fn(),
}));

jest.mock('../src/services/groups', () => ({
  listActiveGroupMembers: jest.fn(),
}));

jest.mock('../src/services/messages', () => ({
  deleteMovieRecommendation: jest.fn(),
  loadOlderMessages: jest.fn(),
  normalizeMessageText: jest.fn((value: string) => value.trim()),
  sendTextMessage: jest.fn(),
  subscribeToLatestMessages: jest.fn(),
  createClientRequestId: jest.fn(() => 'client-request-id'),
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
  seenSubscriptions.length = 0;
  messageSubscriptions.length = 0;
  jest.clearAllMocks();
  jest.mocked(listActiveGroupMembers).mockResolvedValue([]);
  jest.mocked(enrichGroupMovieMetadata).mockResolvedValue({ groupId: 'group-1', groupMovieId: 'tmdb_603', originalTitle: null, imdbId: null });
  jest.mocked(loadOlderMessages).mockResolvedValue({ messages: [], cursor: null, hasMore: false });
  jest.mocked(loadRecommendationHistory).mockResolvedValue([]);
  jest.mocked(saveWatchNote).mockResolvedValue({ groupId: 'group-1', groupMovieId: 'tmdb_603', removed: false });
  jest.mocked(removeWatchNote).mockResolvedValue({ groupId: 'group-1', groupMovieId: 'tmdb_603', removed: true });
  jest.mocked(setMovieSeenStatus).mockImplementation(async (groupId, groupMovieId, seen) => ({ groupId, groupMovieId, seen }));
  jest.mocked(deleteMovieRecommendation).mockResolvedValue({ groupId: 'group-1', messageId: 'movie-message', deleted: true, movieRemoved: false });
  jest.mocked(subscribeToLatestMessages).mockImplementation((groupId, onMessages) => {
    const unsubscribe = jest.fn();
    messageSubscriptions.push({ groupId, onMessages, unsubscribe });
    return unsubscribe;
  });
  jest.mocked(subscribeToGroupMovie).mockImplementation((groupId, groupMovieId, onMovie) => {
    const unsubscribe = jest.fn();
    movieSubscriptions.push({ groupId, groupMovieId, onMovie, unsubscribe });
    return unsubscribe;
  });
  jest.mocked(subscribeToGroupMovies).mockImplementation((groupId, onMovies) => {
    const unsubscribe = jest.fn();
    moviesSubscriptions.push({ groupId, onMovies, unsubscribe });
    onMovies([]);
    return unsubscribe;
  });
  jest.mocked(subscribeToWatchNotes).mockImplementation((groupId, groupMovieId, onNotes) => {
    const unsubscribe = jest.fn();
    noteSubscriptions.push({ groupId, groupMovieId, onNotes, unsubscribe });
    return unsubscribe;
  });
  jest.mocked(subscribeToMovieSeenStatus).mockImplementation((userId, groupMovieId, onStatus) => {
    const unsubscribe = jest.fn();
    seenSubscriptions.push({ userId, groupMovieId, onStatus, unsubscribe });
    onStatus({ seen: false });
    return unsubscribe;
  });
});

describe('GroupDetailScreen default section', () => {
  it('opens a group on the Movies view by default', async () => {
    render(
      <GroupDetailScreen
        group={{ id: 'group-1', name: 'Weekend Watch', ownerId: 'viewer' }}
        userId="viewer"
        displayName="Viewer"
        onBack={jest.fn()}
        onLeft={jest.fn()}
      />,
    );

    expect(screen.getByText('Movies')).toBeOnTheScreen();
    expect(screen.getByText('Movies recommended in this group will appear here.')).toBeOnTheScreen();
    expect(screen.queryByText('No messages yet. Start the conversation.')).toBeNull();
  });

  it('opens the active Members screen and returns to the previous group section', async () => {
    jest.mocked(listActiveGroupMembers).mockResolvedValue([
      { id: 'owner', displayName: 'Group Owner', role: 'owner' },
      { id: 'viewer', displayName: 'Current Member', role: 'member' },
    ]);
    render(
      <GroupDetailScreen
        group={{ id: 'group-1', name: 'Weekend Watch', ownerId: 'owner' }}
        userId="viewer"
        displayName="Viewer"
        onBack={jest.fn()}
        onLeft={jest.fn()}
      />,
    );
    await finishInitialLoad();
    fireEvent.press(screen.getByText('Chat'));
    act(() => messageSubscriptions[0].onMessages([{
      id: 'existing-chat-message',
      type: 'text',
      authorId: 'other-user',
      authorDisplayNameSnapshot: 'Other member',
      text: 'This chat message remains visible',
      createdAt: null,
      clientRequestId: 'existing-chat-request',
    }]));
    fireEvent.press(screen.getByRole('button', { name: 'Members' }));

    expect(await screen.findByText('Group Owner')).toBeOnTheScreen();
    expect(screen.getByText('Owner')).toBeOnTheScreen();
    expect(screen.getByText('Current Member')).toBeOnTheScreen();
    expect(screen.getByText('Member')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByPlaceholderText('Write a message')).toBeOnTheScreen();
    expect(screen.getByText('This chat message remains visible')).toBeOnTheScreen();
  });

  it('lets the author confirm deletion of their chat recommendation and removes the card', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const recommendation: Message = {
      id: 'movie-message', type: 'movie_recommendation', authorId: 'viewer', authorDisplayNameSnapshot: 'Viewer',
      text: 'A note', createdAt: null, clientRequestId: 'request-1',
      movie: { provider: 'tmdb', externalMovieId: '603', title: 'The Matrix', releaseYear: 1999, posterPath: null, overview: null },
      groupMovieId: 'tmdb_603',
    };
    render(<GroupDetailScreen group={{ id: 'group-1', name: 'Weekend Watch', ownerId: 'viewer' }} userId="viewer" displayName="Viewer" onBack={jest.fn()} onLeft={jest.fn()} />);
    await finishInitialLoad();
    fireEvent.press(screen.getByText('Chat'));
    act(() => messageSubscriptions[0].onMessages([recommendation]));

    expect(screen.getByText('The Matrix (1999)')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(alert).toHaveBeenCalledWith('Delete recommendation?', expect.any(String), expect.any(Array));
    const actions = alert.mock.calls[0][2] as { style?: string; onPress?: () => void }[];
    await act(async () => { actions.find((action) => action.style === 'destructive')?.onPress?.(); await Promise.resolve(); });
    expect(deleteMovieRecommendation).toHaveBeenCalledWith('group-1', 'movie-message');
    expect(screen.queryByText('The Matrix (1999)')).toBeNull();
    alert.mockRestore();
  });

  it('does not show a delete action on another member’s recommendation', async () => {
    const recommendation: Message = {
      id: 'other-movie-message', type: 'movie_recommendation', authorId: 'other', authorDisplayNameSnapshot: 'Other',
      text: null, createdAt: null, clientRequestId: 'request-2',
      movie: { provider: 'tmdb', externalMovieId: '603', title: 'The Matrix', releaseYear: 1999, posterPath: null, overview: null },
      groupMovieId: 'tmdb_603',
    };
    render(<GroupDetailScreen group={{ id: 'group-1', name: 'Weekend Watch', ownerId: 'viewer' }} userId="viewer" displayName="Viewer" onBack={jest.fn()} onLeft={jest.fn()} />);
    await finishInitialLoad();
    fireEvent.press(screen.getByText('Chat'));
    act(() => messageSubscriptions[0].onMessages([recommendation]));

    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });
});

describe('GroupMovieDetailScreen realtime watch notes', () => {
  it('allows deleting an authored history entry and updates the list after confirmation', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const ownRecommendation: RecommendationHistoryItem = {
      id: 'movie-message', messageId: 'movie-message', authorId: 'viewer', authorDisplayNameSnapshot: 'Viewer', note: 'My note', createdAt: null,
    };
    jest.mocked(loadRecommendationHistory).mockResolvedValue([ownRecommendation]);
    const onBack = jest.fn();
    render(<GroupMovieDetailScreen groupId="group-1" groupMovieId="tmdb_603" userId="viewer" onBack={onBack} />);
    await finishInitialLoad();
    act(() => {
      movieSubscriptions[0].onMovie(movie());
      noteSubscriptions[0].onNotes([]);
    });

    expect(screen.getByText('My note')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    const actions = alert.mock.calls[0][2] as { style?: string; onPress?: () => void }[];
    await act(async () => { actions.find((action) => action.style === 'destructive')?.onPress?.(); await Promise.resolve(); });
    expect(deleteMovieRecommendation).toHaveBeenCalledWith('group-1', 'movie-message');
    expect(screen.queryByText('My note')).toBeNull();
    expect(onBack).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('returns to the group list when deleting the final recommendation removes the movie', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.mocked(loadRecommendationHistory).mockResolvedValue([{
      id: 'last-message', messageId: 'last-message', authorId: 'viewer', authorDisplayNameSnapshot: 'Viewer', note: null, createdAt: null,
    }]);
    jest.mocked(deleteMovieRecommendation).mockResolvedValue({ groupId: 'group-1', messageId: 'last-message', deleted: true, movieRemoved: true });
    const onBack = jest.fn();
    render(<GroupMovieDetailScreen groupId="group-1" groupMovieId="tmdb_603" userId="viewer" onBack={onBack} />);
    await finishInitialLoad();
    act(() => {
      movieSubscriptions[0].onMovie(movie());
      noteSubscriptions[0].onNotes([]);
    });
    fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    const actions = alert.mock.calls[0][2] as { style?: string; onPress?: () => void }[];
    await act(async () => { actions.find((action) => action.style === 'destructive')?.onPress?.(); await Promise.resolve(); });
    expect(onBack).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

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
    expect(screen.getByRole('button', { name: 'Mark as seen' })).toBeOnTheScreen();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Mark as seen' })); });
    expect(setMovieSeenStatus).toHaveBeenCalledWith('group-1', 'tmdb_603', true);
    expect(await screen.findByRole('button', { name: 'Mark as unseen' })).toBeOnTheScreen();

    act(() => {
      movieListener(movie(1, 5));
      notesListener([watchNote('viewer', 5, 'Excellent first watch')]);
    });
    expect(screen.getAllByText('Excellent first watch')).toHaveLength(2);
    expect(screen.getByText('5.0 average from 1 recommendation')).toBeOnTheScreen();

    act(() => {
      movieListener(movie(1, 3));
      notesListener([watchNote('viewer', 3, 'Updated after a rewatch')]);
    });
    expect(screen.getAllByText('Updated after a rewatch')).toHaveLength(2);
    expect(screen.getByText('3.0 average from 1 recommendation')).toBeOnTheScreen();
    expect(screen.queryByText('Excellent first watch')).toBeNull();

    act(() => {
      movieListener(movie());
      notesListener([]);
    });
    expect(screen.getByText('No member notes yet.')).toBeOnTheScreen();
    expect(screen.getByText('No rating')).toBeOnTheScreen();
    expect(screen.queryByText('Updated after a rewatch')).toBeNull();
  });

  it('shows the original title and an IMDb link when metadata is available', async () => {
    render(<GroupMovieDetailScreen groupId="group-1" groupMovieId="tmdb_603" userId="viewer" onBack={jest.fn()} />);
    await finishInitialLoad();
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

    act(() => {
      movieSubscriptions[0].onMovie({ ...movie(), originalTitle: 'Matriks', imdbId: 'tt0133093' });
      noteSubscriptions[0].onNotes([]);
    });

    expect(screen.getByText('Original title')).toBeOnTheScreen();
    expect(screen.getByText('Matriks (1999)')).toBeOnTheScreen();
    expect(screen.getByText('English title: The Matrix')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('View on IMDb'));
    expect(openURL).toHaveBeenCalledWith('https://www.imdb.com/title/tt0133093');
    openURL.mockRestore();
  });

  it('falls back to the current title and requests metadata once when it is missing', async () => {
    const view = render(<GroupMovieDetailScreen groupId="group-1" groupMovieId="tmdb_603" userId="viewer" onBack={jest.fn()} />);
    await finishInitialLoad();

    act(() => {
      movieSubscriptions[0].onMovie(movie());
      noteSubscriptions[0].onNotes([]);
    });
    view.rerender(<GroupMovieDetailScreen groupId="group-1" groupMovieId="tmdb_603" userId="viewer" onBack={jest.fn()} />);

    expect(screen.getByText('The Matrix (1999)')).toBeOnTheScreen();
    expect(screen.queryByText('View on IMDb')).toBeNull();
    expect(enrichGroupMovieMetadata).toHaveBeenCalledTimes(1);
    expect(enrichGroupMovieMetadata).toHaveBeenCalledWith('group-1', 'tmdb_603');
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
  it('renders localized movie-list controls and cycles sort labels', () => {
    const onAddMovie = jest.fn();
    render(<GroupMoviesScreen groupId="group-1" groupName="Weekend Watch" userId="viewer" onBack={jest.fn()} onAddMovie={onAddMovie} onSelect={jest.fn()} />);

    fireEvent.press(screen.getByText('+ Movie'));
    expect(onAddMovie).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Sort: Rating')).toBeOnTheScreen();

    fireEvent.press(screen.getByText('Sort: Rating'));
    expect(screen.getByText('Sort: Date added')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Sort: Date added'));
    expect(screen.getByText('Sort: Watch notes')).toBeOnTheScreen();
  });

  it('exposes a Groups-list action on Movie List', () => {
    const onBackToGroups = jest.fn();
    render(<GroupMoviesScreen groupId="group-1" groupName="Weekend Watch" userId="viewer" onBack={jest.fn()} onBackToGroups={onBackToGroups} onAddMovie={jest.fn()} onSelect={jest.fn()} />);
    fireEvent.press(screen.getByText('‹ Your groups'));
    expect(onBackToGroups).toHaveBeenCalledTimes(1);
  });

  it('filters movies by the current user seen status and updates when statuses change', () => {
    const matrix = movie();
    const fightClub = { ...movie(), id: 'tmdb_550', externalMovieId: '550', title: 'Fight Club' };
    render(<GroupMoviesScreen groupId="group-1" groupName="Weekend Watch" userId="viewer" onBack={jest.fn()} onAddMovie={jest.fn()} onSelect={jest.fn()} />);

    act(() => moviesSubscriptions[0].onMovies([matrix, fightClub]));
    expect(screen.getByText('The Matrix (1999)')).toBeOnTheScreen();
    expect(screen.getByText('Fight Club (1999)')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'All' })).toBeOnTheScreen();

    act(() => seenSubscriptions[0].onStatus({ seen: true }));
    fireEvent.press(screen.getByRole('button', { name: 'Seen' }));
    expect(screen.getByText('The Matrix (1999)')).toBeOnTheScreen();
    expect(screen.queryByText('Fight Club (1999)')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Unseen' }));
    expect(screen.queryByText('The Matrix (1999)')).toBeNull();
    expect(screen.getByText('Fight Club (1999)')).toBeOnTheScreen();

    act(() => seenSubscriptions[1].onStatus({ seen: true }));
    expect(screen.getByText('No movies match this filter.')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('The Matrix (1999)')).toBeOnTheScreen();
    expect(screen.getByText('Fight Club (1999)')).toBeOnTheScreen();
  });

  it('reflects rating creation, updates, and removal in the movie list', () => {
    render(<GroupMoviesScreen groupId="group-1" groupName="Weekend Watch" userId="viewer" onBack={jest.fn()} onAddMovie={jest.fn()} onSelect={jest.fn()} />);
    expect(screen.getByText('Weekend Watch')).toBeOnTheScreen();
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

  it('shows the original title in the list and falls back to the catalog title', () => {
    render(<GroupMoviesScreen groupId="group-1" groupName="Weekend Watch" userId="viewer" onBack={jest.fn()} onAddMovie={jest.fn()} onSelect={jest.fn()} />);
    const onMovies = moviesSubscriptions[0].onMovies;

    act(() => onMovies([{ ...movie(), originalTitle: 'Matriks' }]));
    expect(screen.getByText('Matriks (1999)')).toBeOnTheScreen();
    expect(screen.queryByText('The Matrix (1999)')).toBeNull();

    act(() => onMovies([movie()]));
    expect(screen.getByText('The Matrix (1999)')).toBeOnTheScreen();
  });

  it('toggles a movie seen status without opening its detail', async () => {
    const onSelect = jest.fn();
    render(<GroupMoviesScreen groupId="group-1" groupName="Weekend Watch" userId="viewer" onBack={jest.fn()} onAddMovie={jest.fn()} onSelect={onSelect} />);
    act(() => moviesSubscriptions[0].onMovies([movie()]));

    expect(seenSubscriptions[0]).toMatchObject({ userId: 'viewer', groupMovieId: 'tmdb_603' });
    fireEvent.press(screen.getByRole('button', { name: 'Seen' }));
    expect(screen.getByText('No movies match this filter.')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Unseen' }));
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Mark as seen' })); });
    expect(setMovieSeenStatus).toHaveBeenCalledWith('group-1', 'tmdb_603', true);
    expect(screen.getByText('No movies match this filter.')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Seen' }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Mark as unseen' })).toBeOnTheScreen();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Mark as unseen' })); });
    expect(setMovieSeenStatus).toHaveBeenLastCalledWith('group-1', 'tmdb_603', false);
    expect(screen.getByText('No movies match this filter.')).toBeOnTheScreen();
  });
});
