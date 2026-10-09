import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, View, StyleSheet } from 'react-native';
import type { User } from 'firebase/auth';
import { AppLocaleProvider } from './src/i18n';
import { subscribeToAuth } from './src/services/auth';
import { WelcomeScreen } from './src/screens/auth/WelcomeScreen';
import { SignInScreen } from './src/screens/auth/SignInScreen';
import { SignUpScreen } from './src/screens/auth/SignUpScreen';
import { GroupsListScreen } from './src/screens/groups/GroupsListScreen';
import { CreateGroupScreen } from './src/screens/groups/CreateGroupScreen';
import { GroupDetailScreen } from './src/screens/groups/GroupDetailScreen';
import { type Group } from './src/services/groups';
import { InvitePreviewScreen } from './src/screens/groups/InvitePreviewScreen';
import { ProfileScreen } from './src/screens/auth/ProfileScreen';
import { getUserDocument } from './src/services/user';
import { clearPendingInvite, getPendingInvite, savePendingInvite } from './src/services/pendingInvite';
import { parseInviteLink } from './src/utils/inviteLink';
import type { InviteReference } from './src/services/invites';

export default function App() {
  return (
    <AppLocaleProvider>
      <AppContent />
    </AppLocaleProvider>
  );
}

function AppContent() {
  const [user, setUser] = useState<User | null>(null); const [ready, setReady] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<InviteReference | null>(null);
  const [inviteReady, setInviteReady] = useState(false);
  const [authScreen, setAuthScreen] = useState<'welcome' | 'signIn' | 'signUp'>('welcome');
  const [screen, setScreen] = useState<'groups' | 'create' | 'group' | 'profile'>('groups'); const [group, setGroup] = useState<Group | null>(null);
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToAuth((nextUser) => { setUser(nextUser); setReady(true); if (!nextUser) { setScreen('groups'); setProfileDisplayName(null); } });
  }, []);

  useEffect(() => {
    let active = true;
    if (!user) return () => { active = false; };
    void getUserDocument(user.uid)
      .then((profile) => { if (active && profile?.displayName) setProfileDisplayName(profile.displayName); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [user]);

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
  const displayName = profileDisplayName || user.displayName || user.email || 'FilmChat member';
  if (screen === 'create') return <CreateGroupScreen userId={user.uid} displayName={displayName} onBack={() => setScreen('groups')} onCreated={(created: Group, _invite: InviteReference) => { setGroup(created); setScreen('group'); }} />;
  if (screen === 'profile') return <ProfileScreen userId={user.uid} fallbackName={displayName} onBack={() => setScreen('groups')} onSaved={(savedName) => { setProfileDisplayName(savedName); setScreen('groups'); }} />;
  if (screen === 'group' && group) return <GroupDetailScreen group={group} userId={user.uid} displayName={displayName} onBack={() => setScreen('groups')} onBackToGroups={() => { setGroup(null); setScreen('groups'); }} onLeft={() => { setGroup(null); setScreen('groups'); }} />;
  return <GroupsListScreen userId={user.uid} onProfile={() => setScreen('profile')} onCreate={() => setScreen('create')} onOpen={(selected) => { setGroup(selected); setScreen('group'); }} />;
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', flex: 1, justifyContent: 'center' },
});