import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View, StyleSheet } from 'react-native';
import { Button } from '../../components/auth/Button';
import { ErrorMessage } from '../../components/auth/ErrorMessage';
import { redeemInvite, previewInvite, type InviteReference } from '../../services/invites';

export function InvitePreviewScreen({ invite, onJoined, onCancel }: {
  invite: InviteReference;
  onJoined: (groupId: string, groupName: string) => void;
  onCancel: () => void;
}) {
  const [group, setGroup] = useState<{ groupId: string; groupName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let active = true;
    void previewInvite(invite)
      .then((preview) => { if (active) setGroup(preview); })
      .catch(() => { if (active) setError('This invite is unavailable.'); });
    return () => { active = false; };
  }, [invite]);

  const join = async () => {
    try {
      setWorking(true);
      const result = await redeemInvite(invite);
      onJoined(result.groupId, result.groupName);
    } catch {
      setError('We could not join this group. Check your connection and try again.');
      setWorking(false);
    }
  };

  return <View style={styles.container}>
    <Text style={styles.eyebrow}>GROUP INVITE</Text>
    {group ? <>
      <Text style={styles.title}>{group.groupName}</Text>
      <Text style={styles.subtitle}>You have been invited to join this private group.</Text>
      <Button label={working ? 'Joining...' : 'Join group'} onPress={() => void join()} />
    </> : error ? <ErrorMessage message={error} /> : <ActivityIndicator />}
    <Button label="Cancel" onPress={onCancel} secondary />
  </View>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#F5F1E8', flex: 1, justifyContent: 'center', padding: 28 },
  eyebrow: { color: '#C05640', fontSize: 14, fontWeight: '800', letterSpacing: 2, marginBottom: 18 },
  title: { color: '#17313B', fontSize: 34, fontWeight: '800', marginBottom: 12 },
  subtitle: { color: '#52656B', fontSize: 17, lineHeight: 25, marginBottom: 28 },
});