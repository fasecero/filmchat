import { messages, pickSupportedLocale } from '../src/i18n';

describe('i18n locale detection', () => {
  it('maps Spanish locales to the Spanish catalog', () => {
    expect(pickSupportedLocale('es-ES')).toBe('es');
    expect(messages.es.welcomeTitle).toBe('Mantén las películas que tu grupo comenta.');
  });

  it('falls back to English when the locale is unsupported', () => {
    expect(pickSupportedLocale('fr-FR')).toBe('en');
    expect(messages.en.signIn).toBe('Sign in');
  });
});
