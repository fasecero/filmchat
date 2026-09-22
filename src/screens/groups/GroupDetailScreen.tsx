import { Text, View, StyleSheet } from 'react-native';
import { Button } from '../../components/auth/Button';
import { signOutUser } from '../../services/auth';
import type { Group } from '../../services/groups';

export function GroupDetailScreen({ group, onBack }: { group: Group; onBack: () => void }) {
  return <View style={styles.container}><Button label="Back to groups" onPress={onBack} secondary /><Text style={styles.title}>{group.name}</Text><Text style={styles.subtitle}>Your group shell is ready. Chat and movie lists arrive next.</Text><Button label="Sign out" onPress={() => void signOutUser()} secondary /></View>;
}
const styles = StyleSheet.create({ container: { backgroundColor: '#F5F1E8', flex: 1, padding: 24 }, title: { color: '#17313B', fontSize: 34, fontWeight: '800', marginTop: 28 }, subtitle: { color: '#52656B', fontSize: 17, lineHeight: 25, marginBottom: 28, marginTop: 12 } });