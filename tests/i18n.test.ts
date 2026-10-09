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

  it('includes translations for the MovieList controls in English and Spanish', () => {
    expect(messages.en.addMovie).toBe('+ Movie');
    expect(messages.en.sortBy).toBe('Sort');
    expect(messages.en.sortRating).toBe('Rating');
    expect(messages.en.sortDateAdded).toBe('Date added');
    expect(messages.en.sortWatchNotes).toBe('Watch notes');
    expect(messages.en.filterAll).toBe('All');
    expect(messages.en.filterUnseen).toBe('Unseen');
    expect(messages.en.filterSeen).toBe('Seen');
    expect(messages.en.profile).toBe('Profile');
    expect(messages.en.members).toBe('Members');
    expect(messages.en.owner).toBe('Owner');
    expect(messages.en.groupMember).toBe('Member');

    expect(messages.es.addMovie).toBe('+ Película');
    expect(messages.es.sortBy).toBe('Ordenar');
    expect(messages.es.sortRating).toBe('Calificación');
    expect(messages.es.sortDateAdded).toBe('Fecha de incorporación');
    expect(messages.es.sortWatchNotes).toBe('Notas de visualización');
    expect(messages.es.filterAll).toBe('Todas');
    expect(messages.es.filterUnseen).toBe('No vistas');
    expect(messages.es.filterSeen).toBe('Vistas');
    expect(messages.es.profile).toBe('Perfil');
    expect(messages.es.members).toBe('Miembros');
    expect(messages.es.owner).toBe('Propietario');
    expect(messages.es.groupMember).toBe('Miembro');
  });
});
