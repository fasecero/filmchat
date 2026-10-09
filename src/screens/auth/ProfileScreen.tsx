import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { Button } from '../../components/auth/Button';
import { useLocale } from '../../i18n';
import { getUserDocument, updateDisplayName } from '../../services/user';

export function ProfileScreen({ userId, fallbackName, onBack, onSaved }: { userId: string; fallbackName: string; onBack: () => void; onSaved: (displayName: string) => void }) {
  const { t } = useLocale();
  const [displayName, setDisplayName] = useState(fallbackName);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void getUserDocument(userId)
      .then((profile) => { if (active && profile?.displayName) setDisplayName(profile.displayName); })
      .catch(() => { if (active) setError(t('loadProfileError')); })
      .finally(() => { if (active) { setLoading(false); setReady(true); } });
    return () => { active = false; };
  }, [userId, t]);

  const save = async () => {
    const normalizedName = displayName.trim();
    if (!normalizedName) { setError(t('displayNameRequired')); return; }
    if (normalizedName.length > 120) { setError(t('displayNameTooLong')); return; }
    setSaving(true);
    setError(null);
    try {
      const savedName = await updateDisplayName(userId, normalizedName);
      onSaved(savedName);
    } catch {
      setError(t('saveProfileError'));
    } finally {
      setSaving(false);
    }
  };

  return <View style={styles.container}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" onPress={onBack}><Text style={styles.back}>{t('back')}</Text></Pressable>
      <Text style={styles.title}>{t('profile')}</Text>
      <View style={styles.spacer} />
    </View>
    {loading ? <ActivityIndicator /> : <View style={styles.form}>
      <Text style={styles.label}>{t('displayName')}</Text>
      <TextInput
        accessibilityLabel={t('displayName')}
        autoCapitalize="words"
        editable={!saving && ready}
        maxLength={120}
        onChangeText={setDisplayName}
        placeholder={t('displayName')}
        style={styles.input}
        value={displayName}
      />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Button label={saving ? t('saving') : t('save')} onPress={() => void save()} />
      <Button label={t('cancel')} onPress={onBack} secondary />
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#F5F1E8', flex: 1, padding: 24 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  back: { color: '#C05640', fontWeight: '800', padding: 10 },
  title: { color: '#17313B', fontSize: 24, fontWeight: '800' },
  spacer: { width: 54 },
  form: { backgroundColor: '#FFFFFF', borderRadius: 14, gap: 14, padding: 20 },
  label: { color: '#52656B', fontSize: 14, fontWeight: '700' },
  input: { borderColor: '#C7D0CD', borderRadius: 10, borderWidth: 1, color: '#17313B', padding: 12 },
  error: { color: '#A3372C', fontSize: 13 },
});
