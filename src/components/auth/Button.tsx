import { Pressable, Text, StyleSheet } from 'react-native';

export function Button({ label, onPress, secondary = false }: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.button, secondary && styles.secondary]}>
      <Text style={[styles.label, secondary && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: '#174A5B', borderRadius: 10, marginBottom: 12, padding: 15 },
  label: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  secondary: { backgroundColor: '#E6F0F2' },
  secondaryLabel: { color: '#174A5B' },
});