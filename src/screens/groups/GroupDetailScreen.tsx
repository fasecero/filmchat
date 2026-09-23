import { Alert, Share, Text, View, StyleSheet } from 'react-native';
import { Button } from '../../components/auth/Button';
import { signOutUser } from '../../services/auth';
import { type Group } from '../../services/groups';
import { buildInviteLink, createInvite, leaveGroup } from '../../services/invites';

export function GroupDetailScreen({ group, onBack, onLeft }: { group: Group; onBack: () => void; onLeft: () => void }) {
  const shareInvite = async () => {
    try {
      const invite = await createInvite(group.id);
      await Share.share({ message: buildInviteLink(invite) });
    } catch {
      Alert.alert('Invite unavailable', 'We could not create an invite right now.');
    }
  };
  const confirmLeave = () => Alert.alert('Leave group?', 'You can rejoin later with a valid invite.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Leave', style: 'destructive', onPress: async () => { await leaveGroup(group.id); onLeft(); } },
  ]);
  return <View style={styles.container}><Button label="Back to groups" onPress={onBack} secondary /><Text style={styles.title}>{group.name}</Text><Text style={styles.subtitle}>Your group shell is ready. Chat and movie lists arrive next.</Text><Button label="Share invite" onPress={() => void shareInvite()} /><Button label="Leave group" onPress={confirmLeave} secondary /><Button label="Sign out" onPress={() => void signOutUser()} secondary /></View>;
}
const styles = StyleSheet.create({ container: { backgroundColor: '#F5F1E8', flex: 1, padding: 24 }, title: { color: '#17313B', fontSize: 34, fontWeight: '800', marginTop: 28 }, subtitle: { color: '#52656B', fontSize: 17, lineHeight: 25, marginBottom: 28, marginTop: 12 } });