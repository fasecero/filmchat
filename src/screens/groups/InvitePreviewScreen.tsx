import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View, StyleSheet } from 'react-native';
import { Button } from '../../components/auth/Button';
import { ErrorMessage } from '../../components/auth/ErrorMessage';
import { useLocale } from '../../i18n';
import { redeemInvite, previewInvite, type InviteReference } from '../../services/invites';

export function InvitePreviewScreen({ invite, onJoined, onCancel }: {
  invite: InviteReference;
  onJoined: (groupId: string, groupName: string) => void;
  onCancel: () => void;
}) {
  const { t } = useLocale();
  const [group, setGroup] = useState<{ groupId: string; groupName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let active = true;
    void previewInvite(invite)
      .then((preview) => { if (active) setGroup(preview); })
      .catch(() => { if (active) setError(t('inviteUnavailable')); });
    return () => { active = false; };
  }, [invite, t]);

  const join = async () => {
    try {
      setWorking(true);
      const result = await redeemInvite(invite);
      onJoined(result.groupId, result.groupName);
    } catch {
      setError(t('joinGroupError'));
      setWorking(false);
    }
  };

  return <View style={styles.container}>
    <Text style={styles.eyebrow}>{t('groupInvite')}</Text>
    {group ? <>
      <Text style={styles.title}>{group.groupName}</Text>
      <Text style={styles.subtitle}>{t('privateInviteMessage')}</Text>
      <Button label={working ? t('joining') : t('joinGroup')} onPress={() => void join()} />
    </> : error ? <ErrorMessage message={error} /> : <ActivityIndicator />}
    <Button label={t('cancel')} onPress={onCancel} secondary />
  </View>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#F5F1E8', flex: 1, justifyContent: 'center', padding: 28 },
  eyebrow: { color: '#C05640', fontSize: 14, fontWeight: '800', letterSpacing: 2, marginBottom: 18 },
  title: { color: '#17313B', fontSize: 34, fontWeight: '800', marginBottom: 12 },
  subtitle: { color: '#52656B', fontSize: 17, lineHeight: 25, marginBottom: 28 },
});