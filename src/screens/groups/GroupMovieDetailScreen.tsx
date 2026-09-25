import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { loadGroupMovie, loadRecommendationHistory, type GroupMovie, type RecommendationHistoryItem } from '../../services/groupMovies';

export function GroupMovieDetailScreen({ groupId, groupMovieId, onBack }: { groupId: string; groupMovieId: string; onBack: () => void }) {
  const [movie, setMovie] = useState<GroupMovie | null>(null);
  const [history, setHistory] = useState<RecommendationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([loadGroupMovie(groupId, groupMovieId), loadRecommendationHistory(groupId, groupMovieId)])
      .then(([nextMovie, nextHistory]) => {
        if (!active) return;
        if (!nextMovie) { setError('This movie is no longer available.'); return; }
        setMovie(nextMovie); setHistory(nextHistory); setError(null);
      })
      .catch(() => { if (active) setError('We could not load this movie.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [groupId, groupMovieId]);

  return <View style={styles.container}>
    <View style={styles.header}><Pressable onPress={onBack}><Text style={styles.action}>Back</Text></Pressable><Text style={styles.title}>Movie</Text><View style={styles.headerSpacer} /></View>
    {loading ? <ActivityIndicator /> : error ? <Text style={styles.status}>{error}</Text> : movie ? <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.summary}>
        {movie.posterPath ? <Image source={{ uri: `https://image.tmdb.org/t/p/w342${movie.posterPath}` }} style={styles.poster} /> : <View style={styles.posterFallback}><Text style={styles.posterFallbackText}>Film</Text></View>}
        <Text style={styles.movieTitle}>{movie.title}{movie.releaseYear ? ` (${movie.releaseYear})` : ''}</Text>
        <Text style={styles.meta}>{movie.recommendationCount} recommendation{movie.recommendationCount === 1 ? '' : 's'}</Text>
        {movie.ratingCount > 0 ? <Text style={styles.meta}>{movie.ratingAverage?.toFixed(1)} average from {movie.ratingCount} rating{movie.ratingCount === 1 ? '' : 's'}</Text> : null}
        {movie.overview ? <Text style={styles.overview}>{movie.overview}</Text> : null}
      </View>
      <Text style={styles.sectionTitle}>Recommendation history</Text>
      {history.length === 0 ? <Text style={styles.status}>No recommendation history found.</Text> : history.map((item) => <View key={item.id} style={styles.historyRow}><Text style={styles.author}>{item.authorDisplayNameSnapshot}</Text>{item.note ? <Text style={styles.note}>{item.note}</Text> : null}<Text style={styles.meta}>{formatTimestamp(item.createdAt)}</Text></View>)}
    </ScrollView> : null}
  </View>;
}

const formatTimestamp = (value: RecommendationHistoryItem['createdAt']) => value ? new Date(value.toMillis()).toLocaleDateString() : 'Recently';

const styles = StyleSheet.create({
  container: { backgroundColor: '#F5F1E8', flex: 1, padding: 16 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 16 },
  title: { color: '#17313B', fontSize: 24, fontWeight: '800' },
  action: { color: '#C05640', fontWeight: '800', padding: 10 },
  headerSpacer: { width: 54 },
  content: { gap: 12, paddingBottom: 24 },
  summary: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, gap: 6, padding: 16 },
  poster: { borderRadius: 8, height: 220, width: 148 },
  posterFallback: { alignItems: 'center', backgroundColor: '#D5DFDA', borderRadius: 8, height: 220, justifyContent: 'center', width: 148 },
  posterFallbackText: { color: '#52656B', fontSize: 14, fontWeight: '700' },
  movieTitle: { color: '#17313B', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  meta: { color: '#52656B', fontSize: 13 },
  overview: { color: '#52656B', lineHeight: 20, marginTop: 6 },
  sectionTitle: { color: '#17313B', fontSize: 18, fontWeight: '800', marginTop: 8 },
  historyRow: { backgroundColor: '#FFFFFF', borderRadius: 10, gap: 4, padding: 12 },
  author: { color: '#C05640', fontWeight: '800' },
  note: { color: '#17313B', lineHeight: 19 },
  status: { color: '#52656B', padding: 24, textAlign: 'center' },
});
