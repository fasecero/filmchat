import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View, StyleSheet } from 'react-native';
import { useLocale } from '../../i18n';
import { listActiveGroupMembers, type GroupMember } from '../../services/groups';

export function GroupMembersScreen({ groupId, groupName, onBack }: { groupId: string; groupName: string; onBack: () => void }) {
  const { t } = useLocale();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listActiveGroupMembers(groupId)
      .then((nextMembers) => { if (active) setMembers(nextMembers); })
      .catch(() => { if (active) setError(t('loadMembersError')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [groupId, t]);

  return <View style={styles.container}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" onPress={onBack}><Text style={styles.back}>{t('back')}</Text></Pressable>
      <View style={styles.titleWrap}><Text style={styles.title}>{groupName}</Text><Text style={styles.subtitle}>{t('members')}</Text></View>
      <View style={styles.spacer} />
    </View>
    {loading ? <ActivityIndicator /> : error ? <Text style={styles.status}>{error}</Text> : <FlatList
      data={members}
      keyExtractor={(member) => member.id}
      contentContainerStyle={members.length === 0 ? styles.emptyList : styles.list}
      ListEmptyComponent={<Text style={styles.status}>{t('noMembers')}</Text>}
      renderItem={({ item }) => <View style={styles.memberRow}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{item.displayName.trim().charAt(0).toLocaleUpperCase()}</Text></View>
        <Text style={styles.memberName}>{item.displayName}</Text>
        <Text style={item.role === 'owner' ? styles.ownerBadge : styles.memberBadge}>{item.role === 'owner' ? t('owner') : t('groupMember')}</Text>
      </View>}
    />}
  </View>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#F5F1E8', flex: 1, padding: 20 },
  header: { alignItems: 'center', flexDirection: 'row', marginBottom: 20 },
  back: { color: '#C05640', fontWeight: '800', padding: 10 },
  titleWrap: { alignItems: 'center', flex: 1 },
  title: { color: '#17313B', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: '#52656B', fontSize: 13, fontWeight: '700', marginTop: 2 },
  spacer: { width: 54 },
  list: { gap: 10 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  memberRow: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, flexDirection: 'row', gap: 12, padding: 14 },
  avatar: { alignItems: 'center', backgroundColor: '#DCE9E5', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  avatarText: { color: '#28705C', fontSize: 16, fontWeight: '800' },
  memberName: { color: '#17313B', flex: 1, fontSize: 16, fontWeight: '700' },
  ownerBadge: { backgroundColor: '#F2D9C9', borderRadius: 10, color: '#7B442E', fontSize: 11, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5 },
  memberBadge: { backgroundColor: '#E7E2D7', borderRadius: 10, color: '#52656B', fontSize: 11, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5 },
  status: { color: '#52656B', padding: 24, textAlign: 'center' },
});
