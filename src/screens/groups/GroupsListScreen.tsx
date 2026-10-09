import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View, StyleSheet } from 'react-native';
import { Button } from '../../components/auth/Button';
import { useLocale } from '../../i18n';
import { listUserGroups, type Group } from '../../services/groups';
import { signOutUser } from '../../services/auth';

export function GroupsListScreen({ userId, onCreate, onOpen, onProfile }: { userId: string; onCreate: () => void; onOpen: (group: Group) => void; onProfile: () => void }) {
  const { t } = useLocale();
  const [groups, setGroups] = useState<Group[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const nextGroups = await listUserGroups(userId);
        if (active) { setError(null); setGroups(nextGroups); }
      } catch (reason) {
        if (active) setError(String(reason));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [userId]);
  return <View style={styles.container}>
    <View style={styles.header}><Text style={styles.title}>{t('yourGroups')}</Text><View style={styles.headerActions}><Pressable accessibilityRole="button" onPress={onProfile}><Text style={styles.action}>{t('profile')}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void signOutUser()}><Text style={styles.action}>{t('signOut')}</Text></Pressable></View></View>
    {loading ? <ActivityIndicator /> : <FlatList data={groups} keyExtractor={(item) => item.id} ListEmptyComponent={<Text style={styles.empty}>{t('noGroupsYet')}</Text>} renderItem={({ item }) => <Pressable onPress={() => onOpen(item)} style={styles.row}><Text style={styles.groupName}>{item.name}</Text><Text style={styles.preview}>{item.lastActivityPreview || t('noActivityYet')}</Text></Pressable>} />}
    {error ? <Text style={styles.error}>{error}</Text> : null}<Button label={t('createGroupShort')} onPress={onCreate} />
  </View>;
}
const styles = StyleSheet.create({ container: { backgroundColor: '#F5F1E8', flex: 1, padding: 24 }, header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }, headerActions: { alignItems: 'center', flexDirection: 'row', gap: 8 }, title: { color: '#17313B', fontSize: 30, fontWeight: '800' }, action: { color: '#C05640', fontWeight: '700' }, empty: { color: '#52656B', fontSize: 16, lineHeight: 24, paddingVertical: 30 }, row: { backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 10, padding: 16 }, groupName: { color: '#17313B', fontSize: 18, fontWeight: '700' }, preview: { color: '#718096', marginTop: 5 }, error: { color: '#B42318', marginBottom: 12 } });