import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase';
import { createUserDocument } from './user';

export const subscribeToAuth = (listener: (user: User | null) => void) =>
  onAuthStateChanged(auth, listener);

export const signUp = async (email: string, password: string, displayName: string) => {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await createUserDocument(credential.user.uid, {
    email: credential.user.email ?? email.trim(),
    displayName: displayName.trim(),
  });
  return credential.user;
};

export const signIn = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email.trim(), password);

export const resetPassword = (email: string) =>
  sendPasswordResetEmail(auth, email.trim());

export const signOutUser = () => signOut(auth);