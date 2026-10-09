import { fireEvent, render, screen } from '@testing-library/react-native';
import { GroupsListScreen } from '../src/screens/groups/GroupsListScreen';
import { listUserGroups } from '../src/services/groups';

jest.mock('../src/services/groups', () => ({
  listUserGroups: jest.fn(),
}));
jest.mock('../src/services/auth', () => ({ signOutUser: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(listUserGroups).mockResolvedValue([]);
});

test('opens the Profile screen from the Groups list action', () => {
  const onProfile = jest.fn();
  render(<GroupsListScreen userId="user-1" onCreate={jest.fn()} onOpen={jest.fn()} onProfile={onProfile} />);
  fireEvent.press(screen.getByRole('button', { name: 'Profile' }));
  expect(onProfile).toHaveBeenCalledTimes(1);
});
