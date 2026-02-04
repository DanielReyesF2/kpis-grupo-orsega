import { describe, it, expect } from 'vitest';
import { messageMatchesUpdateIntent, normalizeForIntent } from '../intentUpdateVentas';

describe('normalizeForIntent', () => {
  it('lowercase and trim', () => {
    expect(normalizeForIntent('  ACTUALIZA  ')).toBe('actualiza');
  });
  it('removes accents', () => {
    expect(normalizeForIntent('actualízalo')).toBe('actualizalo');
  });
  it('collapses spaces', () => {
    expect(normalizeForIntent('actualiza   ventas')).toBe('actualiza ventas');
  });
});

describe('messageMatchesUpdateIntent', () => {
  it('matches "actualiza"', () => {
    expect(messageMatchesUpdateIntent('actualiza')).toBe(true);
  });
  it('matches "actualiza ventas"', () => {
    expect(messageMatchesUpdateIntent('actualiza ventas')).toBe(true);
  });
  it('matches "por favor actualizar"', () => {
    expect(messageMatchesUpdateIntent('por favor actualizar')).toBe(true);
  });
  it('matches typo "actualisar"', () => {
    expect(messageMatchesUpdateIntent('actualisar')).toBe(true);
  });
  it('matches "sube los datos"', () => {
    expect(messageMatchesUpdateIntent('sube los datos')).toBe(true);
  });
  it('matches with accent "actualízalo"', () => {
    expect(messageMatchesUpdateIntent('actualízalo')).toBe(true);
  });
  it('does not match "no actualices"', () => {
    expect(messageMatchesUpdateIntent('no actualices')).toBe(false);
  });
  it('does not match "solo analiza, no actualices"', () => {
    expect(messageMatchesUpdateIntent('solo analiza, no actualices')).toBe(false);
  });
  it('does not match "analiza este archivo"', () => {
    expect(messageMatchesUpdateIntent('analiza este archivo')).toBe(false);
  });
  it('does not match empty string', () => {
    expect(messageMatchesUpdateIntent('')).toBe(false);
  });
});
