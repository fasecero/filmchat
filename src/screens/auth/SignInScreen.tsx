import { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Button } from '../../components/auth/Button';
import { ErrorMessage } from '../../components/auth/ErrorMessage';
import { InputField } from '../../components/auth/InputField';
import { useLocale } from '../../i18n';
import { resetPassword, signIn } from '../../services/auth';

export function SignInScreen({ onBack }: { onBack: () => void }) {
  const { t } = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    try { setError(null); await signIn(email, password); } catch (reason) { setError(String(reason)); }
  };
  const forgotPassword = async () => {
    try { setError(null); await resetPassword(email); setError(t('passwordResetSent')); } catch (reason) { setError(String(reason)); }
  };
  return <View style={styles.container}>
    <Text style={styles.title}>{t('welcomeBack')}</Text>
    <InputField autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} placeholder={t('email')} value={email} />
    <InputField onChangeText={setPassword} placeholder={t('password')} secureTextEntry value={password} />
    <ErrorMessage message={error} />
    <Button label={t('signIn')} onPress={submit} />
    <Button label={t('forgotPassword')} onPress={forgotPassword} secondary />
    <Button label={t('back')} onPress={onBack} secondary />
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', padding: 28 }, title: { color: '#17313B', fontSize: 30, fontWeight: '800', marginBottom: 24 } });