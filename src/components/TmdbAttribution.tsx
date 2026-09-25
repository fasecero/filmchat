import { Linking, Pressable, Text, StyleSheet } from 'react-native';

export function TmdbAttribution() {
  return <Pressable onPress={() => void Linking.openURL('https://www.themoviedb.org/')} accessibilityRole="link">
    <Text style={styles.text}>Movie data by TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  text: { color: '#52656B', fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
