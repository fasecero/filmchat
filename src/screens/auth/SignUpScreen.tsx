import { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Button } from '../../components/auth/Button';
import { ErrorMessage } from '../../components/auth/ErrorMessage';
import { InputField } from '../../components/auth/InputField';
import { useLocale } from '../../i18n';
import { signUp } from '../../services/auth';

export function SignUpScreen({ onBack }: { onBack: () => void }) {
  const { t } = useLocale();
  const [displayName, setDisplayName] = useState(''); const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!displayName.trim()) { setError(t('displayNameRequired')); return; }
    try { setError(null); await signUp(email, password, displayName); } catch (reason) { setError(String(reason)); }
  };
  return <View style={styles.container}>
    <Text style={styles.title}>{t('createYourAccount')}</Text>
    <InputField onChangeText={setDisplayName} placeholder={t('displayName')} value={displayName} />
    <InputField autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} placeholder={t('email')} value={email} />
    <InputField onChangeText={setPassword} placeholder={t('password')} secureTextEntry value={password} />
    <ErrorMessage message={error} /><Button label={t('createAccountButton')} onPress={submit} /><Button label={t('back')} onPress={onBack} secondary />
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', padding: 28 }, title: { color: '#17313B', fontSize: 30, fontWeight: '800', marginBottom: 24 } });