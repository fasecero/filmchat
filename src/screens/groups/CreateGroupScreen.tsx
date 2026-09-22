import { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Button } from '../../components/auth/Button';
import { ErrorMessage } from '../../components/auth/ErrorMessage';
import { InputField } from '../../components/auth/InputField';
import { createGroup, type Group } from '../../services/groups';

export function CreateGroupScreen({ userId, displayName, onBack, onCreated }: { userId: string; displayName: string; onBack: () => void; onCreated: (group: Group) => void }) {
  const [name, setName] = useState(''); const [error, setError] = useState<string | null>(null);
  const submit = async () => { try { setError(null); onCreated(await createGroup(userId, displayName, name)); } catch (reason) { setError(String(reason)); } };
  return <View style={styles.container}><Text style={styles.title}>Create a group</Text><Text style={styles.subtitle}>Give your movie circle a name.</Text><InputField autoFocus maxLength={60} onChangeText={setName} placeholder="Group name" value={name} /><ErrorMessage message={error} /><Button label="Create group" onPress={submit} /><Button label="Back" onPress={onBack} secondary /></View>;
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', padding: 28 }, title: { color: '#17313B', fontSize: 30, fontWeight: '800', marginBottom: 8 }, subtitle: { color: '#52656B', fontSize: 16, marginBottom: 24 } });