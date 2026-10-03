import { buildInviteLink, parseInviteLink } from '../src/utils/inviteLink';

describe('invite links', () => {
  it('parses valid HTTPS invite URLs', () => {
    const invite = { inviteId: 'invite-123', token: 'token/with spaces' };
    const link = `https://newfilmchat-prod.web.app/invite/${encodeURIComponent(invite.inviteId)}?token=${encodeURIComponent(invite.token)}`;

    expect(parseInviteLink(link)).toEqual(invite);
  });

  it('parses valid legacy filmchat invite URLs', () => {
    const invite = { inviteId: 'invite-123', token: 'legacy-token' };
    const link = `filmchat://invite/${encodeURIComponent(invite.inviteId)}?token=${encodeURIComponent(invite.token)}`;

    expect(parseInviteLink(link)).toEqual(invite);
  });

  it('builds HTTPS invite URLs in the production format', () => {
    const invite = { inviteId: 'invite-123', token: 'token/with spaces' };

    expect(buildInviteLink(invite)).toBe(
      `https://newfilmchat-prod.web.app/invite/${encodeURIComponent(invite.inviteId)}?token=${encodeURIComponent(invite.token)}`,
    );
  });

  it.each([
    ['missing invite ID', 'https://newfilmchat-prod.web.app/invite/?token=abc'],
    ['missing token', 'https://newfilmchat-prod.web.app/invite/invite-123'],
    ['wrong HTTPS hostname', 'https://example.com/invite/invite-123?token=abc'],
    ['wrong HTTPS path', 'https://newfilmchat-prod.web.app/groups/invite/invite-123?token=abc'],
    ['unsupported scheme', 'mailto://invite/invite-123?token=abc'],
    ['malformed URL', 'https://[invalid'],
  ])('returns null for %s', (_label, value) => {
    expect(parseInviteLink(value)).toBeNull();
  });

  it('round-trips URL-encoded invite IDs and tokens', () => {
    const invite = {
      inviteId: 'invite/with?chars&more=done',
      token: 'token with / + = ? & emoji 🚀',
    };

    expect(parseInviteLink(buildInviteLink(invite))).toEqual(invite);
  });

  it('buildInviteLink followed by parseInviteLink preserves the original InviteReference', () => {
    const invite = { inviteId: 'invite-123', token: 'token/with spaces' };

    expect(parseInviteLink(buildInviteLink(invite))).toEqual(invite);
  });
});