import {
  ExtensionAnswers,
  ExtensionApplicationList,
  ExtensionProfile,
  ExtensionSavedJob,
  type ExtensionApplication,
  type ExtensionSaveJobInput,
} from '@cv-pilot/contracts';
import { z } from 'zod';
import type { ResumeFile } from './fill/messages';

/** Erro da API com o código que ela devolveu (`unauthorized`, `consent_required`...). */
export class ExtensionApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
    this.name = 'ExtensionApiError';
  }
}

const ErrorBody = z.object({ error: z.string() });
const SentReply = z.object({ id: z.string(), status: z.string() });
const QuestionsReply = z.object({ pending: z.number() });

/** Bytes em base64, aos pedaços: `String.fromCharCode(...bytes)` estoura a pilha com 5 MB. */
function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Cliente das rotas `/extension` da API, com o token da extensão (ADR 0010). */
export function extensionApi(baseUrl: string, token: string, fetchImpl: typeof fetch = fetch) {
  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}/extension${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${token}`,
          ...(init.body ? { 'content-type': 'application/json' } : {}),
        },
      });
    } catch {
      throw new ExtensionApiError(0, 'network_error');
    }
    if (!res.ok) {
      const body = ErrorBody.safeParse(await res.json().catch(() => null));
      throw new ExtensionApiError(res.status, body.data?.error ?? `http_${res.status}`);
    }
    return res;
  }

  return {
    async profile(): Promise<ExtensionProfile> {
      return ExtensionProfile.parse(await (await request('/me')).json());
    },

    async applications(): Promise<ExtensionApplication[]> {
      return ExtensionApplicationList.parse(await (await request('/applications')).json());
    },

    async resume(application: ExtensionApplication): Promise<ResumeFile> {
      const res = await request(`/applications/${application.id}/resume`);
      return {
        fileName: application.resume.fileName,
        mimeType: application.resume.mimeType,
        base64: toBase64(new Uint8Array(await res.arrayBuffer())),
      };
    },

    async markSent(applicationId: string) {
      const res = await request(`/applications/${applicationId}/sent`, { method: 'POST' });
      return SentReply.parse(await res.json());
    },

    /** Banco de respostas (ADR 0011): pergunta → resposta, só as respondidas. */
    async answers(): Promise<Record<string, string>> {
      return ExtensionAnswers.parse(await (await request('/answers')).json());
    },

    /** Guarda as perguntas que ficaram sem resposta; diz quantas ainda esperam o candidato. */
    async reportQuestions(questions: string[]) {
      const res = await request('/questions', {
        method: 'POST',
        body: JSON.stringify({ questions }),
      });
      return QuestionsReply.parse(await res.json());
    },

    async saveJob(job: ExtensionSaveJobInput) {
      const res = await request('/jobs', { method: 'POST', body: JSON.stringify(job) });
      return ExtensionSavedJob.parse(await res.json());
    },
  };
}
