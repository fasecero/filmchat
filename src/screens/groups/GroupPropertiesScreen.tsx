import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useLocale } from '../../i18n';
import { getGroup, listActiveGroupMembers, type Group } from '../../services/groups';
import { subscribeToGroupMovies, type GroupMovie } from '../../services/groupMovies';
import { leaveGroup } from '../../services/invites';

type GroupPropertiesScreenProps = {
  group: Group;
  onBackToGroups: () => void;
  onMovies: () => void;
  onChat: () => void;
  onShare: () => void;
  onLeft: () => void;
};

const getCreatedDate = (value: unknown): Date | null => {
  if (!value || typeof value !== 'object' || !('toDate' in value) || typeof value.toDate !== 'function') return null;
  const date = value.toDate();
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
};

export function GroupPropertiesScreen({ group, onBackToGroups, onMovies, onChat, onShare, onLeft }: GroupPropertiesScreenProps) {
  const { t } = useLocale();
  const [members, setMembers] = useState<{ id: string; displayName: string; role: 'owner' | 'member' }[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState(false);
  const [movies, setMovies] = useState<GroupMovie[]>([]);
  const [moviesLoading, setMoviesLoading] = useState(true);
  const [moviesError, setMoviesError] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState(false);
  const [createdAt, setCreatedAt] = useState<unknown>(group.createdAt);

  useEffect(() => {
    setCreatedAt(group.createdAt);
    if (group.createdAt) return;
    let active = true;
    void getGroup(group.id)
      .then((latestGroup) => { if (active) setCreatedAt(latestGroup?.createdAt); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [group.id, group.createdAt]);

  useEffect(() => {
    let active = true;
    void listActiveGroupMembers(group.id)
      .then((nextMembers) => { if (active) setMembers(nextMembers); })
      .catch(() => { if (active) setMembersError(true); })
      .finally(() => { if (active) setMembersLoading(false); });
    return () => { active = false; };
  }, [group.id]);

  useEffect(() => subscribeToGroupMovies(
    group.id,
    (nextMovies) => { setMovies(nextMovies); setMoviesError(false); setMoviesLoading(false); },
    () => { setMoviesError(true); setMoviesLoading(false); },
  ), [group.id]);

  const createdDate = getCreatedDate(createdAt);
  const confirmLeave = () => Alert.alert(t('leaveGroupPrompt'), t('leaveGroupDetails'), [
    { text: t('cancel'), style: 'cancel' },
    { text: t('leaveGroup'), style: 'destructive', onPress: () => {
      setLeaving(true);
      setLeaveError(false);
      void leaveGroup(group.id)
        .then(() => onLeft())
        .catch(() => { setLeaveError(true); setLeaving(false); });
    } },
  ]);

  return <ScrollView contentContainerStyle={styles.container}>
    <Pressable accessibilityRole="button" onPress={onBackToGroups} style={styles.backToGroups}><Text style={styles.backToGroupsText}>‹ {t('yourGroups')}</Text></Pressable>
    <Text style={styles.eyebrow}>{t('groupProperties')}</Text>
    <Text accessibilityRole="header" style={styles.title}>{group.name}</Text>
    {createdDate ? <View style={styles.card}>
      <Text style={styles.label}>{t('groupCreated')}</Text>
      <Text style={styles.value}>{createdDate.toLocaleDateString()}</Text>
    </View> : null}
    <View style={styles.card}>
      <Text style={styles.label}>{t('activeMembers')}</Text>
      {membersLoading ? <ActivityIndicator color="#28705C" /> : membersError ? <Text style={styles.status}>{t('loadMembersError')}</Text> : members.length === 0 ? <Text style={styles.status}>{t('noMembers')}</Text> : members.map((member) => (
        <View key={member.id} style={styles.memberRow}>
          <Text style={styles.memberName}>{member.displayName}</Text>
          <Text style={member.role === 'owner' ? styles.ownerBadge : styles.memberBadge}>{member.role === 'owner' ? t('owner') : t('groupMember')}</Text>
        </View>
      ))}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={`${t('recommendedMovies')}: ${movies.length}`} onPress={onMovies} style={styles.card}>
      <Text style={styles.label}>{t('recommendedMovies')}</Text>
      {moviesLoading ? <ActivityIndicator color="#28705C" /> : moviesError ? <Text style={styles.status}>{t('loadMovieError')}</Text> : <Text style={styles.value}>{movies.length}</Text>}
    </Pressable>
    {leaveError ? <Text style={styles.error}>{t('leaveGroupError')}</Text> : null}
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" onPress={onChat} style={styles.action}><Text style={styles.actionText}>{t('chat')}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={onShare} style={styles.action}><Text style={styles.actionText}>{t('share')}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: leaving }} disabled={leaving} onPress={confirmLeave} style={styles.leaveAction}><Text style={styles.leaveText}>{leaving ? t('leaving') : t('leaveGroup')}</Text></Pressable>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#F5F1E8', flexGrow: 1, gap: 14, padding: 20 },
  backToGroups: { alignSelf: 'flex-start', marginBottom: 8, paddingHorizontal: 6, paddingVertical: 4 },
  backToGroupsText: { color: '#52656B', fontSize: 12, fontWeight: '700' },
  eyebrow: { color: '#C05640', fontSize: 13, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { color: '#17313B', fontSize: 28, fontWeight: '800' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, gap: 8, padding: 14 },
  label: { color: '#52656B', fontSize: 13, fontWeight: '800' },
  value: { color: '#17313B', fontSize: 18, fontWeight: '700' },
  status: { color: '#52656B', fontSize: 14 },
  error: { color: '#A3372C', fontSize: 14 },
  memberRow: { alignItems: 'center', borderTopColor: '#E7E2D7', borderTopWidth: 1, flexDirection: 'row', gap: 12, paddingTop: 9 },
  memberName: { color: '#17313B', flex: 1, fontSize: 15, fontWeight: '700' },
  ownerBadge: { backgroundColor: '#F2D9C9', borderRadius: 10, color: '#7B442E', fontSize: 11, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5 },
  memberBadge: { backgroundColor: '#E7E2D7', borderRadius: 10, color: '#52656B', fontSize: 11, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5 },
  actions: { gap: 10, marginTop: 4 },
  action: { alignItems: 'center', backgroundColor: '#28705C', borderRadius: 12, minHeight: 48, justifyContent: 'center', padding: 12 },
  actionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  leaveAction: { alignItems: 'center', borderColor: '#C05640', borderRadius: 12, borderWidth: 1, minHeight: 48, justifyContent: 'center', padding: 12 },
  leaveText: { color: '#A3372C', fontSize: 15, fontWeight: '800' },
});
