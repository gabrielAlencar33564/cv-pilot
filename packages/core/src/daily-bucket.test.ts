import { describe, expect, it } from 'vitest';
import { dailyBucket, localHour } from './daily-bucket';

describe('dailyBucket', () => {
  // 02:30 em UTC do dia 19 ainda é 23:30 do dia 18 em São Paulo (UTC-3)
  const madrugadaUtc = new Date('2026-11-19T02:30:00Z');

  it('usa o dia no fuso do usuário, não o do servidor', () => {
    expect(dailyBucket(madrugadaUtc, 'America/Sao_Paulo')).toBe('2026-11-18');
    expect(dailyBucket(madrugadaUtc, 'UTC')).toBe('2026-11-19');
  });

  it('vira o dia à meia-noite local', () => {
    expect(dailyBucket(new Date('2026-11-19T02:59:59Z'), 'America/Sao_Paulo')).toBe('2026-11-18');
    expect(dailyBucket(new Date('2026-11-19T03:00:00Z'), 'America/Sao_Paulo')).toBe('2026-11-19');
  });

  it('recusa fuso inválido', () => {
    expect(() => dailyBucket(madrugadaUtc, 'Lua/Base')).toThrow(RangeError);
  });
});

describe('localHour', () => {
  it('devolve a hora no fuso do usuário', () => {
    // 11:00 UTC = 08:00 em São Paulo
    expect(localHour(new Date('2026-11-19T11:00:00Z'), 'America/Sao_Paulo')).toBe(8);
    expect(localHour(new Date('2026-11-19T11:00:00Z'), 'UTC')).toBe(11);
  });

  it('meia-noite é 0', () => {
    expect(localHour(new Date('2026-11-19T03:00:00Z'), 'America/Sao_Paulo')).toBe(0);
  });
});
