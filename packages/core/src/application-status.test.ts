import { ApplicationStatus } from '@cv-pilot/contracts';
import { describe, expect, it } from 'vitest';
import { canTransition, manualTransitions } from './application-status';

describe('máquina de estados da candidatura', () => {
  it('ninguém põe uma candidatura na fila à mão', () => {
    for (const from of ApplicationStatus.options) {
      expect(canTransition(from, 'queued')).toBe(false);
    }
  });

  it('só marca como enviada a partir de "Ação necessária" (envio assistido)', () => {
    expect(canTransition('needs_action', 'sent')).toBe(true);
    expect(canTransition('suggested', 'sent')).toBe(false);
    expect(canTransition('queued', 'sent')).toBe(false);
  });

  it('segue o funil depois do envio', () => {
    expect(canTransition('sent', 'in_process')).toBe(true);
    expect(canTransition('in_process', 'interview')).toBe(true);
    expect(canTransition('interview', 'offer')).toBe(true);
  });

  it('reabre recusada ou sem resposta quando a empresa volta', () => {
    expect(canTransition('rejected', 'interview')).toBe(true);
    expect(canTransition('no_response', 'in_process')).toBe(true);
  });

  it('não volta uma candidatura enviada para sugerida', () => {
    expect(canTransition('sent', 'suggested')).toBe(false);
  });

  it('candidatura na fila ou sugerida não tem transição manual', () => {
    expect(manualTransitions('queued')).toEqual([]);
    expect(manualTransitions('suggested')).toEqual([]);
  });

  it('nenhuma transição manual leva ao próprio status', () => {
    for (const from of ApplicationStatus.options) {
      expect(manualTransitions(from)).not.toContain(from);
    }
  });
});
