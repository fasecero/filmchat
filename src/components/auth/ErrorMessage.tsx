import { Text, StyleSheet } from 'react-native';

export function ErrorMessage({ message }: { message: string | null }) {
  return message ? <Text style={styles.error}>{message}</Text> : null;
}

const styles = StyleSheet.create({
  error: { color: '#B42318', marginBottom: 12 },
});