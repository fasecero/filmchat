import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

export type UserDocument = {
  id: string;
  email: string;
  displayName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export const createUserDocument = async (userId: string, userData: {
  email: string;
  displayName: string;
}) => {
  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, {
    email: userData.email,
    displayName: userData.displayName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const getUserDocument = async (userId: string): Promise<UserDocument | null> => {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  return userSnap.exists()
    ? { id: userSnap.id, ...userSnap.data() } as UserDocument
    : null;
};

export const updateUserDocument = async (userId: string, updates: Partial<{
  displayName: string;
  email: string;
}>) => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};
