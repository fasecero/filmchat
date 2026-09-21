import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

import { auth, db } from './src/firebase';

export default function App() {
  const [status, setStatus] = useState('Connecting...');

  useEffect(() => {
    async function testFirebase() {
      try {
        setStatus('Signing in...');

        const credential = await signInAnonymously(auth);
        const userId = credential.user.uid;

        setStatus(`Authenticated: ${userId}`);

        const testRef = doc(db, 'test', 'hello');

        await setDoc(testRef, {
          message: 'Hello from FilmChat',
          userId,
          timestamp: new Date().toISOString(),
        });

        const snapshot = await getDoc(testRef);

        if (snapshot.exists()) {
          setStatus(
            `SUCCESS\n\n${JSON.stringify(snapshot.data(), null, 2)}`
          );
        } else {
          setStatus('ERROR: document was not found');
        }
      } catch (error) {
        console.error(error);
        setStatus(`ERROR\n\n${String(error)}`);
      }
    }

    testFirebase();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{status}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
  },
});