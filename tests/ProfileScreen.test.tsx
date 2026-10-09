import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ProfileScreen } from '../src/screens/auth/ProfileScreen';
import { getUserDocument, updateDisplayName } from '../src/services/user';

jest.mock('../src/services/user', () => ({
  getUserDocument: jest.fn(),
  updateDisplayName: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getUserDocument).mockResolvedValue({ id: 'user-1', email: 'user@example.com', displayName: 'Current Name' });
  jest.mocked(updateDisplayName).mockResolvedValue('New Name');
});

describe('ProfileScreen', () => {
  it('loads and saves a trimmed display name', async () => {
    const onSaved = jest.fn();
    render(<ProfileScreen userId="user-1" fallbackName="Fallback" onBack={jest.fn()} onSaved={onSaved} />);

    const input = await screen.findByDisplayValue('Current Name');
    fireEvent.changeText(input, '  New Name  ');
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(updateDisplayName).toHaveBeenCalledWith('user-1', 'New Name');
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('New Name'));
  });

  it('rejects a blank display name without calling the service', async () => {
    render(<ProfileScreen userId="user-1" fallbackName="Fallback" onBack={jest.fn()} onSaved={jest.fn()} />);
    const input = await screen.findByDisplayValue('Current Name');
    fireEvent.changeText(input, '   ');
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Display name is required.')).toBeOnTheScreen();
    expect(updateDisplayName).not.toHaveBeenCalled();
  });

  it('shows a save error and keeps the form available', async () => {
    jest.mocked(updateDisplayName).mockRejectedValue(new Error('network unavailable'));
    render(<ProfileScreen userId="user-1" fallbackName="Fallback" onBack={jest.fn()} onSaved={jest.fn()} />);
    await screen.findByDisplayValue('Current Name');
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText("We couldn't save your profile. Try again.")).toBeOnTheScreen();
    expect(screen.getByDisplayValue('Current Name')).toBeOnTheScreen();
  });
});
