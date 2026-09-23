import { buildInviteLink, parseInviteLink } from '../src/utils/inviteLink';

describe('invite links', () => {
  it('round-trips an invite reference', () => {
    const invite = { inviteId: 'invite-123', token: 'token/with spaces' };

    expect(parseInviteLink(buildInviteLink(invite))).toEqual(invite);
  });

  it('rejects malformed or unrelated links', () => {
    expect(parseInviteLink('not a link')).toBeNull();
    expect(parseInviteLink('https://example.com/invite/invite-123?token=abc')).toBeNull();
    expect(parseInviteLink('filmchat://invite/invite-123')).toBeNull();
  });
});