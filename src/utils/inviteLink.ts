import type { InviteReference } from '../services/invites';

const INVITE_HOST = 'newfilmchat-prod.web.app';

export const buildInviteLink = (invite: InviteReference) =>
  `https://${INVITE_HOST}/invite/${encodeURIComponent(invite.inviteId)}?token=${encodeURIComponent(invite.token)}`;

export const parseInviteLink = (value: string): InviteReference | null => {
  try {
    const url = new URL(value);

    const isHttpsInvite =
      url.protocol === 'https:' &&
      url.hostname === INVITE_HOST &&
      url.pathname.startsWith('/invite/');

    const isCustomSchemeInvite =
      url.protocol === 'filmchat:' &&
      url.hostname === 'invite';

    if (!isHttpsInvite && !isCustomSchemeInvite) return null;

    const inviteId = decodeURIComponent(
      isHttpsInvite
        ? url.pathname.replace(/^\/invite\//, '')
        : url.pathname.replace(/^\//, ''),
    );

    const token = url.searchParams.get('token');

    if (!inviteId || !token) return null;

    return { inviteId, token };
  } catch {
    return null;
  }
};