import type { InviteReference } from '../services/invites';

export const buildInviteLink = (invite: InviteReference) =>
  `filmchat://invite/${encodeURIComponent(invite.inviteId)}?token=${encodeURIComponent(invite.token)}`;

export const parseInviteLink = (value: string): InviteReference | null => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'filmchat:' || url.hostname !== 'invite') return null;
    const inviteId = decodeURIComponent(url.pathname.replace(/^\//, ''));
    const token = url.searchParams.get('token');
    if (!inviteId || !token) return null;
    return { inviteId, token };
  } catch {
    return null;
  }
};