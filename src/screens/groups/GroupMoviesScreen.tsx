import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, Text, View, StyleSheet } from 'react-native';
import { type GroupMovie, subscribeToGroupMovies } from '../../services/groupMovies';

export function GroupMoviesScreen({ groupId, onBack, onSelect }: { groupId: string; onBack: () => void; onSelect: (movie: GroupMovie) => void }) {
  const [movies, setMovies] = useState<GroupMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToGroupMovies(
      groupId,
      (nextMovies) => { setMovies(nextMovies); setError(null); setLoading(false); },
      () => { setError('We could not load this group\'s movies.'); setLoading(false); },
    );
    return unsubscribe;
  }, [groupId]);

  return <View style={styles.container}>
    <View style={styles.header}><Pressable onPress={onBack}><Text style={styles.action}>Chat</Text></Pressable><Text style={styles.title}>Movies</Text><View style={styles.headerSpacer} /></View>
    {loading ? <ActivityIndicator /> : error ? <Text style={styles.status}>{error}</Text> : <FlatList
      data={movies}
      keyExtractor={(movie) => movie.id}
      contentContainerStyle={movies.length === 0 ? styles.emptyList : styles.list}
      ListEmptyComponent={<Text style={styles.status}>Movies recommended in this group will appear here.</Text>}
      renderItem={({ item }) => <Pressable onPress={() => onSelect(item)} style={styles.row}>
        {item.posterPath ? <Image source={{ uri: `https://image.tmdb.org/t/p/w185${item.posterPath}` }} style={styles.poster} /> : <View style={styles.posterFallback}><Text style={styles.posterFallbackText}>Film</Text></View>}
        <View style={styles.info}><Text style={styles.movieTitle}>{item.title}{item.releaseYear ? ` (${item.releaseYear})` : ''}</Text><Text style={styles.meta}>{item.recommendationCount} recommendation{item.recommendationCount === 1 ? '' : 's'}</Text>{item.ratingCount > 0 ? <Text style={styles.meta}>{item.ratingAverage?.toFixed(1)} average from {item.ratingCount}</Text> : null}</View>
      </Pressable>}
    />}
  </View>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#F5F1E8', flex: 1, padding: 16 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 16 },
  title: { color: '#17313B', fontSize: 24, fontWeight: '800' },
  action: { color: '#C05640', fontWeight: '800', padding: 10 },
  headerSpacer: { width: 54 },
  list: { gap: 10 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  row: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, flexDirection: 'row', gap: 12, padding: 10 },
  poster: { borderRadius: 6, height: 84, width: 60 },
  posterFallback: { alignItems: 'center', backgroundColor: '#D5DFDA', borderRadius: 6, height: 84, justifyContent: 'center', width: 60 },
  posterFallbackText: { color: '#52656B', fontSize: 12, fontWeight: '700' },
  info: { flex: 1, gap: 4 },
  movieTitle: { color: '#17313B', fontSize: 16, fontWeight: '800' },
  meta: { color: '#52656B', fontSize: 13 },
  status: { color: '#52656B', padding: 24, textAlign: 'center' },
});
