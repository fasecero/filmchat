import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, Text, View, StyleSheet } from 'react-native';
import { TmdbAttribution } from '../../components/TmdbAttribution';
import { useLocale } from '../../i18n';
import { getWatchNoteCount, type GroupMovie, subscribeToGroupMovies } from '../../services/groupMovies';
import { setMovieSeenStatus, subscribeToMovieSeenStatus } from '../../services/movieSeenStatus';

type SortMode = 'rating' | 'date' | 'watchNotes';

export function GroupMoviesScreen({ groupId, groupName, userId, onBack, onAddMovie, onSelect }: { groupId: string; groupName: string; userId: string; onBack: () => void; onAddMovie: () => void; onSelect: (movie: GroupMovie) => void }) {
  const { t } = useLocale();
  const [movies, setMovies] = useState<GroupMovie[]>([]);
  const [watchNoteCounts, setWatchNoteCounts] = useState<Record<string, number>>({});
  const [seenByMovie, setSeenByMovie] = useState<Record<string, boolean>>({});
  const [savingSeenByMovie, setSavingSeenByMovie] = useState<Record<string, boolean>>({});
  const [seenError, setSeenError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('rating');

  useEffect(() => {
    const unsubscribe = subscribeToGroupMovies(
      groupId,
      (nextMovies) => { setMovies(nextMovies); setError(null); setLoading(false); },
      () => { setError(t('loadMovieError')); setLoading(false); },
    );
    return unsubscribe;
  }, [groupId, t]);

  useEffect(() => {
    const unsubscribes = movies.map((movie) => subscribeToMovieSeenStatus(
      userId,
      movie.id,
      (status) => setSeenByMovie((current) => ({ ...current, [movie.id]: status.seen })),
      () => setSeenError(t('loadSeenStatusError')),
    ));
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [movies, userId, t]);

  useEffect(() => {
    if (movies.length === 0) return;
    let active = true;
    void Promise.all(movies.map(async (movie) => ({ movieId: movie.id, count: await getWatchNoteCount(groupId, movie.id) })))
      .then((counts) => {
        if (!active) return;
        setWatchNoteCounts(Object.fromEntries(counts.map(({ movieId, count }) => [movieId, count])));
      })
      .catch(() => { if (active) setWatchNoteCounts({}); });
    return () => { active = false; };
  }, [groupId, movies]);

  const cycleSort = () => {
    setSortMode((current) => current === 'rating' ? 'date' : current === 'date' ? 'watchNotes' : 'rating');
  };

  const toggleSeen = async (movie: GroupMovie) => {
    const nextSeen = !(seenByMovie[movie.id] ?? false);
    setSavingSeenByMovie((current) => ({ ...current, [movie.id]: true }));
    setSeenError(null);
    try {
      await setMovieSeenStatus(groupId, movie.id, nextSeen);
      setSeenByMovie((current) => ({ ...current, [movie.id]: nextSeen }));
    } catch {
      setSeenError(t('saveSeenStatusError'));
    } finally {
      setSavingSeenByMovie((current) => ({ ...current, [movie.id]: false }));
    }
  };

  const sortedMovies = useMemo(() => {
    const nextMovies = [...movies];
    nextMovies.sort((left, right) => {
      switch (sortMode) {
        case 'date':
          return (right.lastRecommendedAt?.toMillis() ?? 0) - (left.lastRecommendedAt?.toMillis() ?? 0)
            || (right.ratingAverage ?? -1) - (left.ratingAverage ?? -1)
            || right.recommendationCount - left.recommendationCount;
        case 'watchNotes':
          return (watchNoteCounts[right.id] ?? 0) - (watchNoteCounts[left.id] ?? 0)
            || (right.lastRecommendedAt?.toMillis() ?? 0) - (left.lastRecommendedAt?.toMillis() ?? 0);
        case 'rating':
        default:
          return (right.ratingAverage ?? -1) - (left.ratingAverage ?? -1)
            || right.ratingCount - left.ratingCount
            || (right.lastRecommendedAt?.toMillis() ?? 0) - (left.lastRecommendedAt?.toMillis() ?? 0);
      }
    });
    return nextMovies;
  }, [movies, sortMode, watchNoteCounts]);

  const sortLabel = sortMode === 'rating' ? t('sortRating') : sortMode === 'date' ? t('sortDateAdded') : t('sortWatchNotes');

  return <View style={styles.container}>
    <View style={styles.header}><Pressable onPress={onBack}><Text style={styles.action}>{t('chat')}</Text></Pressable><View style={styles.headerTitle}><Text style={styles.title}>{groupName}</Text><Text style={styles.subtitle}>{t('movies')}</Text></View><Pressable onPress={onAddMovie}><Text style={styles.action}>{t('addMovie')}</Text></Pressable></View>
    <View style={styles.sortRow}><Pressable onPress={cycleSort} style={styles.sortButton}><Text style={styles.sortText}>{`${t('sortBy')}: ${sortLabel}`}</Text></Pressable></View>
    {seenError ? <Text style={styles.statusError}>{seenError}</Text> : null}
    {loading ? <ActivityIndicator /> : error ? <Text style={styles.status}>{error}</Text> : <FlatList
      data={sortedMovies}
      keyExtractor={(movie) => movie.id}
      contentContainerStyle={sortedMovies.length === 0 ? styles.emptyList : styles.list}
      ListEmptyComponent={<Text style={styles.status}>{t('noMoviesYet')}</Text>}
      renderItem={({ item }) => <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={() => onSelect(item)} style={styles.movieRowContent}>
          {item.posterPath ? <Image source={{ uri: `https://image.tmdb.org/t/p/w185${item.posterPath}` }} style={styles.poster} /> : <View style={styles.posterFallback}><Text style={styles.posterFallbackText}>Film</Text></View>}
          <View style={styles.info}><Text style={styles.movieTitle}>{item.title}{item.releaseYear ? ` (${item.releaseYear})` : ''}</Text><Text style={styles.meta}>{item.recommendationCount} {item.recommendationCount === 1 ? t('recommendationCountOne') : t('recommendationCountMany')}</Text>{item.ratingCount > 0 ? <Text style={styles.meta}>{item.ratingAverage?.toFixed(1)} {t('averageFrom')} {item.ratingCount}</Text> : null}</View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={savingSeenByMovie[item.id] ? t('saving') : (seenByMovie[item.id] ?? false) ? t('markUnseen') : t('markSeen')}
          accessibilityState={{ selected: seenByMovie[item.id] ?? false, disabled: savingSeenByMovie[item.id] ?? false }}
          disabled={savingSeenByMovie[item.id]}
          onPress={() => void toggleSeen(item)}
          style={styles.seenButton}
        >
          {savingSeenByMovie[item.id] ? <ActivityIndicator size="small" color="#28705C" /> : <Text style={(seenByMovie[item.id] ?? false) ? styles.seenIconSelected : styles.seenIcon}>{(seenByMovie[item.id] ?? false) ? '✓' : '○'}</Text>}
        </Pressable>
      </View>}
    />}
    <TmdbAttribution />
  </View>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#F5F1E8', flex: 1, padding: 16 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 8 },
  headerTitle: { alignItems: 'center', flex: 1, paddingHorizontal: 8 },
  title: { color: '#17313B', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: '#52656B', fontSize: 12, fontWeight: '700', marginTop: 2 },
  action: { color: '#C05640', fontWeight: '800', padding: 10 },
  sortRow: { marginBottom: 12 },
  sortButton: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  sortText: { color: '#17313B', fontWeight: '700' },
  list: { gap: 10 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  row: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, flexDirection: 'row', gap: 8, padding: 10 },
  movieRowContent: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 12 },
  seenButton: { alignItems: 'center', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  seenIcon: { color: '#879493', fontSize: 23, fontWeight: '500', lineHeight: 28 },
  seenIconSelected: { color: '#28705C', fontSize: 22, fontWeight: '800', lineHeight: 28 },
  poster: { borderRadius: 6, height: 84, width: 60 },
  posterFallback: { alignItems: 'center', backgroundColor: '#D5DFDA', borderRadius: 6, height: 84, justifyContent: 'center', width: 60 },
  posterFallbackText: { color: '#52656B', fontSize: 12, fontWeight: '700' },
  info: { flex: 1, gap: 4 },
  movieTitle: { color: '#17313B', fontSize: 16, fontWeight: '800' },
  meta: { color: '#52656B', fontSize: 13 },
  status: { color: '#52656B', padding: 24, textAlign: 'center' },
  statusError: { color: '#A3372C', paddingBottom: 8, textAlign: 'center' },
});
