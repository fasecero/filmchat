import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

export type Group = {
  id: string;
  name: string;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  lastActivityAt?: unknown;
  lastActivityPreview?: string;
};

export const createGroup = async (userId: string, displayName: string, name: string) => {
  const trimmedName = name.trim();
  if (!trimmedName || trimmedName.length > 60) {
    throw new Error('Group name must be between 1 and 60 characters.');
  }

  const groupRef = doc(collection(db, 'groups'));
  const memberRef = doc(db, 'groups', groupRef.id, 'members', userId);
  const userGroupRef = doc(db, 'users', userId, 'groups', groupRef.id);
  const batch = writeBatch(db);
  const timestamp = serverTimestamp();

  batch.set(groupRef, {
    name: trimmedName,
    ownerId: userId,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastActivityAt: timestamp,
    lastActivityPreview: '',
  });
  batch.set(memberRef, {
    userId,
    displayNameSnapshot: displayName,
    role: 'owner',
    status: 'active',
    joinedAt: timestamp,
    updatedAt: timestamp,
  });
  batch.set(userGroupRef, {
    groupId: groupRef.id,
    name: trimmedName,
    status: 'active',
    updatedAt: timestamp,
  });
  await batch.commit();
  return { id: groupRef.id, name: trimmedName, ownerId: userId } satisfies Group;
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
  return groups.filter((group): group is Group => group !== null);
};

export const getGroup = async (groupId: string) => {
  const snapshot = await getDoc(doc(db, 'groups', groupId));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Group) : null;
};