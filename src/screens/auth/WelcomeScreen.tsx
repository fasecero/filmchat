import { Text, View, StyleSheet } from 'react-native';
import { Button } from '../../components/auth/Button';
import { TmdbAttribution } from '../../components/TmdbAttribution';
import { useLocale } from '../../i18n';

export function WelcomeScreen({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  const { t } = useLocale();

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>{t('appName').toUpperCase()}</Text>
      <Text style={styles.title}>{t('welcomeTitle')}</Text>
      <Text style={styles.subtitle}>{t('welcomeSubtitle')}</Text>
      <Button label={t('createAccount')} onPress={onSignUp} />
      <Button label={t('signIn')} onPress={onSignIn} secondary />
      <TmdbAttribution />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#F5F1E8', flex: 1, justifyContent: 'center', padding: 28 },
  eyebrow: { color: '#C05640', fontSize: 14, fontWeight: '800', letterSpacing: 2, marginBottom: 18 },
  title: { color: '#17313B', fontSize: 38, fontWeight: '800', lineHeight: 44, marginBottom: 14 },
  subtitle: { color: '#52656B', fontSize: 17, lineHeight: 25, marginBottom: 32 },
});