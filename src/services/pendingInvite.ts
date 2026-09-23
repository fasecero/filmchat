import AsyncStorage from '@react-native-async-storage/async-storage';
import type { InviteReference } from './invites';

const storage = AsyncStorage;
const pendingInviteKey = 'pending-invite';

export const savePendingInvite = (invite: InviteReference) =>
  storage.setItem(pendingInviteKey, JSON.stringify(invite));

export const getPendingInvite = async (): Promise<InviteReference | null> => {
  const value = await storage.getItem(pendingInviteKey);
  if (!value) return null;
  try {
    const invite = JSON.parse(value) as InviteReference;
    return invite.inviteId && invite.token ? invite : null;
  } catch {
    return null;
  }
};

export const clearPendingInvite = () => storage.removeItem(pendingInviteKey);