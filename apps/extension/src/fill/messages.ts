import type { ExtensionApplication } from '@cv-pilot/contracts';
import type { FieldSource, FillData } from './match-field';

/** O currículo que vai no campo de arquivo, em base64 (mensagens entre partes só levam JSON). */
export interface ResumeFile {
  fileName: string;
  mimeType: string;
  base64: string;
}

/** Pedido do popup para a página: preencha com estes dados. */
export interface FillRequest {
  type: 'cvpilot:fill';
  data: FillData;
  resume: ResumeFile | null;
}

/** O que foi feito na página, para o candidato conferir antes de enviar. */
export interface FillReport {
  filled: { label: string; source: FieldSource }[];
  resumeAttached: boolean;
  /** campos obrigatórios que continuaram vazios */
  requiredEmpty: number;
}

/** Mensagens do popup para o service worker, que cuida das abas. */
export type BackgroundMessage =
  | { type: 'open'; application: Pick<ExtensionApplication, 'id' | 'url'> }
  | { type: 'fill'; applicationId: string; request: FillRequest };

export type BackgroundReply = { ok: true; report?: FillReport } | { ok: false; error: string };
