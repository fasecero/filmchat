import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import {
  loadGroupMovie,
  loadRecommendationHistory,
  loadWatchNotes,
  MAX_WATCH_NOTE_PLATFORM_LENGTH,
  MAX_WATCH_NOTE_REVIEW_LENGTH,
  removeWatchNote,
  saveWatchNote,
  type GroupMovie,
  type RecommendationHistoryItem,
  type WatchNote,
} from '../../services/groupMovies';

export function GroupMovieDetailScreen({ groupId, groupMovieId, userId, onBack }: { groupId: string; groupMovieId: string; userId: string; onBack: () => void }) {
  const [movie, setMovie] = useState<GroupMovie | null>(null);
  const [history, setHistory] = useState<RecommendationHistoryItem[]>([]);
  const [watchNotes, setWatchNotes] = useState<WatchNote[]>([]);
  const [rating, setRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [watchedOn, setWatchedOn] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const loadDetails = useCallback(() => Promise.all([
      loadGroupMovie(groupId, groupMovieId),
      loadRecommendationHistory(groupId, groupMovieId),
      loadWatchNotes(groupId, groupMovieId),
    ]), [groupId, groupMovieId]);

  const applyDetails = useCallback(([nextMovie, nextHistory, nextWatchNotes]: Awaited<ReturnType<typeof loadDetails>>) => {
    if (!nextMovie) throw new Error('This movie is no longer available.');
    const ownNote = nextWatchNotes.find((note) => note.userId === userId);
    setMovie(nextMovie); setHistory(nextHistory); setWatchNotes(nextWatchNotes);
    setRating(ownNote?.rating ?? null); setReviewText(ownNote?.reviewText ?? ''); setWatchedOn(ownNote?.watchedOn ?? '');
    setEditing(!ownNote);
  }, [userId]);

  useEffect(() => {
    let active = true;
    void loadDetails().then((details) => { if (active) applyDetails(details); }).catch(() => { if (active) setError('We could not load this movie.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadDetails, applyDetails]);

  const save = async () => {
    const nextReview = reviewText.trim(); const nextPlatform = watchedOn.trim();
    if (nextReview.length > MAX_WATCH_NOTE_REVIEW_LENGTH || nextPlatform.length > MAX_WATCH_NOTE_PLATFORM_LENGTH) { setFormError('Your review or platform is too long.'); return; }
    if (rating === null && !nextReview && !nextPlatform) { setFormError('Add a rating, review, or platform before saving.'); return; }
    setSaving(true); setFormError(null);
    try { await saveWatchNote(groupId, groupMovieId, { rating, reviewText: nextReview, watchedOn: nextPlatform }); applyDetails(await loadDetails()); setEditing(false); }
    catch { setFormError('We could not save your watch note.'); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    setSaving(true); setFormError(null);
    try { await removeWatchNote(groupId, groupMovieId); applyDetails(await loadDetails()); }
    catch { setFormError('We could not remove your watch note.'); }
    finally { setSaving(false); }
  };

  return <View style={styles.container}>
    <View style={styles.header}><Pressable onPress={onBack}><Text style={styles.action}>Back</Text></Pressable><Text style={styles.title}>Movie</Text><View style={styles.headerSpacer} /></View>
    {loading ? <ActivityIndicator /> : error ? <Text style={styles.status}>{error}</Text> : movie ? <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.summary}>
        {movie.posterPath ? <Image source={{ uri: `https://image.tmdb.org/t/p/w342${movie.posterPath}` }} style={styles.poster} /> : <View style={styles.posterFallback}><Text style={styles.posterFallbackText}>Film</Text></View>}
        <Text style={styles.movieTitle}>{movie.title}{movie.releaseYear ? ` (${movie.releaseYear})` : ''}</Text>
        <Text style={styles.meta}>{movie.recommendationCount} recommendation{movie.recommendationCount === 1 ? '' : 's'}</Text>
        <Text style={styles.meta}>{movie.ratingAverage === null ? 'No ratings yet' : `${movie.ratingAverage.toFixed(1)} average from ${movie.ratingCount} rating${movie.ratingCount === 1 ? '' : 's'}`}</Text>
        {movie.overview ? <Text style={styles.overview}>{movie.overview}</Text> : null}
      </View>
      <View style={styles.editor}>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Your watch note</Text>{!editing ? <Pressable onPress={() => setEditing(true)}><Text style={styles.action}>Edit</Text></Pressable> : null}</View>
        {editing ? <>
          <Text style={styles.label}>Rating</Text>
          <View style={styles.stars}>{[1, 2, 3, 4, 5].map((value) => <Pressable key={value} onPress={() => setRating(value)} accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}><Text style={value <= (rating ?? 0) ? styles.starSelected : styles.star}>★</Text></Pressable>)}</View>
          <TextInput value={reviewText} onChangeText={setReviewText} maxLength={MAX_WATCH_NOTE_REVIEW_LENGTH} multiline placeholder="Short review" style={[styles.input, styles.reviewInput]} />
          <TextInput value={watchedOn} onChangeText={setWatchedOn} maxLength={MAX_WATCH_NOTE_PLATFORM_LENGTH} placeholder="Platform or medium" style={styles.input} />
          {formError ? <Text style={styles.error}>{formError}</Text> : null}
          <View style={styles.buttonRow}><Pressable disabled={saving} onPress={() => void save()} style={styles.primaryButton}><Text style={styles.primaryText}>{saving ? 'Saving...' : 'Save'}</Text></Pressable>{watchNotes.some((note) => note.userId === userId) ? <Pressable disabled={saving} onPress={() => void remove()} style={styles.secondaryButton}><Text style={styles.secondaryText}>Remove</Text></Pressable> : null}</View>
        </> : <View style={styles.noteSummary}><Text style={styles.starsText}>{rating ? `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}` : 'No rating'}</Text>{reviewText ? <Text style={styles.note}>{reviewText}</Text> : null}{watchedOn ? <Text style={styles.meta}>Watched on {watchedOn}</Text> : null}</View>}
      </View>
      <Text style={styles.sectionTitle}>Member watch notes</Text>
      {watchNotes.length === 0 ? <Text style={styles.status}>No member notes yet.</Text> : watchNotes.map((note) => <View key={note.id} style={styles.historyRow}><Text style={styles.author}>{note.userId === userId ? 'You' : note.displayNameSnapshot}</Text><Text style={styles.starsText}>{note.rating ? `${'★'.repeat(note.rating)}${'☆'.repeat(5 - note.rating)}` : 'No rating'}</Text>{note.reviewText ? <Text style={styles.note}>{note.reviewText}</Text> : null}{note.watchedOn ? <Text style={styles.meta}>Watched on {note.watchedOn}</Text> : null}</View>)}
      <Text style={styles.sectionTitle}>Recommendation history</Text>
      {history.length === 0 ? <Text style={styles.status}>No recommendation history found.</Text> : history.map((item) => <View key={item.id} style={styles.historyRow}><Text style={styles.author}>{item.authorDisplayNameSnapshot}</Text>{item.note ? <Text style={styles.note}>{item.note}</Text> : null}<Text style={styles.meta}>{formatTimestamp(item.createdAt)}</Text></View>)}
    </ScrollView> : null}
  </View>;
}

const formatTimestamp = (value: RecommendationHistoryItem['createdAt']) => value ? new Date(value.toMillis()).toLocaleDateString() : 'Recently';

const styles = StyleSheet.create({
  container: { backgroundColor: '#F5F1E8', flex: 1, padding: 16 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 16 },
  title: { color: '#17313B', fontSize: 24, fontWeight: '800' }, action: { color: '#C05640', fontWeight: '800', padding: 10 }, headerSpacer: { width: 54 },
  content: { gap: 12, paddingBottom: 24 }, summary: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, gap: 6, padding: 16 },
  poster: { borderRadius: 8, height: 220, width: 148 }, posterFallback: { alignItems: 'center', backgroundColor: '#D5DFDA', borderRadius: 8, height: 220, justifyContent: 'center', width: 148 }, posterFallbackText: { color: '#52656B', fontSize: 14, fontWeight: '700' },
  movieTitle: { color: '#17313B', fontSize: 20, fontWeight: '800', textAlign: 'center' }, meta: { color: '#52656B', fontSize: 13 }, overview: { color: '#52656B', lineHeight: 20, marginTop: 6 },
  editor: { backgroundColor: '#FFFFFF', borderRadius: 12, gap: 8, padding: 16 }, sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, sectionTitle: { color: '#17313B', fontSize: 18, fontWeight: '800', marginTop: 8 }, label: { color: '#52656B', fontSize: 13, fontWeight: '700' },
  stars: { flexDirection: 'row', gap: 8 }, star: { color: '#B8C1BC', fontSize: 32 }, starSelected: { color: '#C05640', fontSize: 32 }, starsText: { color: '#C05640', fontSize: 18 }, input: { borderColor: '#D5DFDA', borderRadius: 8, borderWidth: 1, color: '#17313B', padding: 10 }, reviewInput: { minHeight: 72, textAlignVertical: 'top' }, error: { color: '#A13A2A', fontSize: 13 },
  buttonRow: { flexDirection: 'row', gap: 10 }, primaryButton: { backgroundColor: '#C05640', borderRadius: 8, padding: 12 }, primaryText: { color: '#FFFFFF', fontWeight: '800' }, secondaryButton: { borderColor: '#C05640', borderRadius: 8, borderWidth: 1, padding: 12 }, secondaryText: { color: '#C05640', fontWeight: '800' }, noteSummary: { gap: 5 }, note: { color: '#17313B', lineHeight: 19 },
  historyRow: { backgroundColor: '#FFFFFF', borderRadius: 10, gap: 4, padding: 12 }, author: { color: '#C05640', fontWeight: '800' }, status: { color: '#52656B', padding: 24, textAlign: 'center' },
});