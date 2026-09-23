import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, View, StyleSheet } from 'react-native';
import type { User } from 'firebase/auth';
import { subscribeToAuth } from './src/services/auth';
import { WelcomeScreen } from './src/screens/auth/WelcomeScreen';
import { SignInScreen } from './src/screens/auth/SignInScreen';
import { SignUpScreen } from './src/screens/auth/SignUpScreen';
import { GroupsListScreen } from './src/screens/groups/GroupsListScreen';
import { CreateGroupScreen } from './src/screens/groups/CreateGroupScreen';
import { GroupDetailScreen } from './src/screens/groups/GroupDetailScreen';
import { type Group } from './src/services/groups';
import { InvitePreviewScreen } from './src/screens/groups/InvitePreviewScreen';
import { clearPendingInvite, getPendingInvite, savePendingInvite } from './src/services/pendingInvite';
import { parseInviteLink } from './src/utils/inviteLink';
import type { InviteReference } from './src/services/invites';

export default function App() {
  const [user, setUser] = useState<User | null>(null); const [ready, setReady] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<InviteReference | null>(null);
  const [inviteReady, setInviteReady] = useState(false);
  const [authScreen, setAuthScreen] = useState<'welcome' | 'signIn' | 'signUp'>('welcome');
  const [screen, setScreen] = useState<'groups' | 'create' | 'group'>('groups'); const [group, setGroup] = useState<Group | null>(null);

  useEffect(() => {
    return subscribeToAuth((nextUser) => { setUser(nextUser); setReady(true); if (!nextUser) setScreen('groups'); });
  }, []);

  useEffect(() => {
    let active = true;
    const acceptUrl = async (url: string | null) => {
      const invite = url ? parseInviteLink(url) : null;
      if (!invite) return;
      await savePendingInvite(invite);
      if (active) setPendingInvite(invite);
    };
    void getPendingInvite().then((invite) => { if (active) { setPendingInvite(invite); setInviteReady(true); } });
    void Linking.getInitialURL().then(acceptUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => { void acceptUrl(url); });
    return () => { active = false; subscription.remove(); };
  }, []);

  if (!ready || !inviteReady) return <View style={styles.loading}><ActivityIndicator /></View>;
  if (!user) {
    if (authScreen === 'signIn') return <SignInScreen onBack={() => setAuthScreen('welcome')} />;
    if (authScreen === 'signUp') return <SignUpScreen onBack={() => setAuthScreen('welcome')} />;
    return <WelcomeScreen onSignIn={() => setAuthScreen('signIn')} onSignUp={() => setAuthScreen('signUp')} />;
  }
  if (pendingInvite) return <InvitePreviewScreen invite={pendingInvite} onCancel={() => { void clearPendingInvite(); setPendingInvite(null); }} onJoined={(groupId, groupName) => { void clearPendingInvite(); setPendingInvite(null); setGroup({ id: groupId, name: groupName, ownerId: user.uid }); setScreen('group'); }} />;
  if (screen === 'create') return <CreateGroupScreen userId={user.uid} displayName={user.displayName || user.email || 'FilmChat member'} onBack={() => setScreen('groups')} onCreated={(created: Group, _invite: InviteReference) => { setGroup(created); setScreen('group'); }} />;
  if (screen === 'group' && group) return <GroupDetailScreen group={group} userId={user.uid} displayName={user.displayName || user.email || 'FilmChat member'} onBack={() => setScreen('groups')} onLeft={() => { setGroup(null); setScreen('groups'); }} />;
  return <GroupsListScreen userId={user.uid} onCreate={() => setScreen('create')} onOpen={(selected) => { setGroup(selected); setScreen('group'); }} />;
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', flex: 1, justifyContent: 'center' },
});