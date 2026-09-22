import { Text, View, StyleSheet } from 'react-native';
import { Button } from '../../components/auth/Button';

export function WelcomeScreen({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>FILMCHAT</Text>
      <Text style={styles.title}>Keep the movies your group talks about.</Text>
      <Text style={styles.subtitle}>Private groups, easy recommendations, one shared list.</Text>
      <Button label="Create an account" onPress={onSignUp} />
      <Button label="Sign in" onPress={onSignIn} secondary />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#F5F1E8', flex: 1, justifyContent: 'center', padding: 28 },
  eyebrow: { color: '#C05640', fontSize: 14, fontWeight: '800', letterSpacing: 2, marginBottom: 18 },
  title: { color: '#17313B', fontSize: 38, fontWeight: '800', lineHeight: 44, marginBottom: 14 },
  subtitle: { color: '#52656B', fontSize: 17, lineHeight: 25, marginBottom: 32 },
});