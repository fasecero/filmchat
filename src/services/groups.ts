import {
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  collection,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';

export type Group = {
  id: string;
  name: string;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  lastActivityAt?: unknown;
  lastActivityPreview?: string;
};

type CreateGroupResponse = {
  inviteId: string;
  token: string;
  groupId: string;
  name: string;
  ownerId: string;
};

export const createGroup = async (userId: string, displayName: string, name: string) => {
  const trimmedName = name.trim();
  if (!trimmedName || trimmedName.length > 60) {
    throw new Error('Group name must be between 1 and 60 characters.');
  }
  void userId;
  void displayName;
  const callable = httpsCallable<{ name: string }, CreateGroupResponse>(functions, 'createGroup');
  const response = await callable({ name: trimmedName });
  return { ...response.data, id: response.data.groupId };
};

export const listUserGroups = async (userId: string): Promise<Group[]> => {
  const memberships = await getDocs(
    query(collection(db, 'users', userId, 'groups'), orderBy('updatedAt', 'desc')),
  );
  const groups = await Promise.all(
    memberships.docs
      .filter((membership) => membership.data().status === 'active')
      .map(async (membership) => {
        const groupSnapshot = await getDoc(doc(db, 'groups', membership.id));
        return groupSnapshot.exists()
          ? ({ id: groupSnapshot.id, ...groupSnapshot.data() } as Group)
          : null;
      }),
  );
  return groups
    .filter((group): group is Group => group !== null)
    .sort((left, right) => timestampMillis(right.lastActivityAt) - timestampMillis(left.lastActivityAt));
};

export const getGroup = async (groupId: string) => {
  const snapshot = await getDoc(doc(db, 'groups', groupId));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Group) : null;
};

const timestampMillis = (value: unknown) => value && typeof value === 'object' && 'toMillis' in value
  ? (value as { toMillis: () => number }).toMillis()
  : 0;