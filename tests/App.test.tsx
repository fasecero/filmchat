import { render, screen, waitFor } from '@testing-library/react-native';
import App from '../App';

jest.mock('../src/services/auth', () => ({
  subscribeToAuth: (listener: (user: null) => void) => {
    listener(null);
    return () => undefined;
  },
}));
jest.mock('../src/services/groups', () => ({
  listUserGroups: jest.fn().mockResolvedValue([]),
  createGroup: jest.fn(),
}));
jest.mock('../src/services/invites', () => ({
  previewInvite: jest.fn(),
  redeemInvite: jest.fn(),
  createInvite: jest.fn(),
  leaveGroup: jest.fn(),
  buildInviteLink: jest.fn(),
}));
jest.mock('../src/services/pendingInvite', () => ({
  getPendingInvite: jest.fn().mockResolvedValue(null),
  savePendingInvite: jest.fn(),
  clearPendingInvite: jest.fn(),
}));

describe('application shell', () => {
  it('renders the welcome screen for signed-out users', async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByText('Create an account')).toBeOnTheScreen());
  });
});
