import type { SourceHealth } from '@cv-pilot/contracts';

/** A partir desta fração de execuções com problema, a fonte está falhando, não só instável. */
const FAILING_RATE = 0.5;

interface SourceActivity {
  active: boolean;
  /** execuções de ingestão na janela (24 h no admin) */
  runs: number;
  /** execuções que não terminaram com sucesso: erro, bloqueio ou limite de requisições */
  failures: number;
}

/**
 * Saúde da fonte para o admin (RF-80). Saudável é rodar sem nenhum problema na janela,
 * como na métrica do PRD ("sem erro nas últimas 24 h"). Fonte desligada aparece como pausada,
 * mesmo que tenha rodado antes.
 */
export function sourceHealth({ active, runs, failures }: SourceActivity): SourceHealth {
  if (!active) return 'paused';
  if (runs === 0) return 'idle';
  if (failures === 0) return 'healthy';
  return failures / runs >= FAILING_RATE ? 'failing' : 'degraded';
}
