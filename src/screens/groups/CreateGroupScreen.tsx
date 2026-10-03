import { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Button } from '../../components/auth/Button';
import { ErrorMessage } from '../../components/auth/ErrorMessage';
import { InputField } from '../../components/auth/InputField';
import { useLocale } from '../../i18n';
import { createGroup, type Group } from '../../services/groups';
import type { InviteReference } from '../../services/invites';

export function CreateGroupScreen({ userId, displayName, onBack, onCreated }: { userId: string; displayName: string; onBack: () => void; onCreated: (group: Group, invite: InviteReference) => void }) {
  const { t } = useLocale();
  const [name, setName] = useState(''); const [error, setError] = useState<string | null>(null);
  const submit = async () => { try { setError(null); const created = await createGroup(userId, displayName, name); onCreated(created, created); } catch (reason) { setError(String(reason)); } };
  return <View style={styles.container}><Text style={styles.title}>{t('createGroupTitle')}</Text><Text style={styles.subtitle}>{t('createGroupSubtitle')}</Text><InputField autoFocus maxLength={60} onChangeText={setName} placeholder={t('groupName')} value={name} /><ErrorMessage message={error} /><Button label={t('createGroupButton')} onPress={submit} /><Button label={t('back')} onPress={onBack} secondary /></View>;
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', padding: 28 }, title: { color: '#17313B', fontSize: 30, fontWeight: '800', marginBottom: 8 }, subtitle: { color: '#52656B', fontSize: 16, marginBottom: 24 } });