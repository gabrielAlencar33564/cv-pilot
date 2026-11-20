import { describe, expect, it, vi } from 'vitest';
import { ExtensionApiError, extensionApi } from './api';

const candidatura = {
  id: 'cand-1',
  url: 'https://vagas.exemplo.test/1',
  job: { title: 'Dev React', company: 'Acme' },
  source: { displayName: 'Gupy' },
  coverLetter: null,
  coverLetterStatus: null,
  answers: {},
  resume: { name: 'CV', version: 1, fileName: 'cv.pdf', mimeType: 'application/pdf' },
};

const resposta = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('extensionApi', () => {
  it('manda o token e valida a resposta com o contrato', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(resposta([candidatura]));
    const api = extensionApi('http://api.test', 'cvp_ext_x', fetchFalso);

    await expect(api.applications()).resolves.toEqual([candidatura]);
    expect(fetchFalso).toHaveBeenCalledWith('http://api.test/extension/applications', {
      headers: { authorization: 'Bearer cvp_ext_x' },
    });
  });

  it('resposta fora do contrato é recusada', async () => {
    const api = extensionApi('http://api.test', 't', vi.fn().mockResolvedValue(resposta([{}])));

    await expect(api.applications()).rejects.toThrow();
  });

  it('erro da API vira ExtensionApiError com o código', async () => {
    const api = extensionApi(
      'http://api.test',
      't',
      vi.fn().mockResolvedValue(resposta({ error: 'consent_required' }, 403)),
    );

    await expect(api.profile()).rejects.toMatchObject({ status: 403, code: 'consent_required' });
  });

  it('sem rede, o erro diz que não deu para falar com a API', async () => {
    const api = extensionApi('http://api.test', 't', vi.fn().mockRejectedValue(new TypeError()));

    const falha = api.profile();
    await expect(falha).rejects.toBeInstanceOf(ExtensionApiError);
    await expect(falha).rejects.toMatchObject({ code: 'network_error' });
  });

  it('o currículo chega em base64, com o nome e o tipo da versão', async () => {
    const pdf = new Response(new TextEncoder().encode('%PDF-1.7 teste'));
    const api = extensionApi('http://api.test', 't', vi.fn().mockResolvedValue(pdf));

    const arquivo = await api.resume(candidatura);
    expect(arquivo).toMatchObject({ fileName: 'cv.pdf', mimeType: 'application/pdf' });
    expect(atob(arquivo.base64)).toBe('%PDF-1.7 teste');
  });

  it('marcar como enviada usa POST', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(resposta({ id: 'cand-1', status: 'sent' }));
    await extensionApi('http://api.test', 't', fetchFalso).markSent('cand-1');

    expect(fetchFalso).toHaveBeenCalledWith(
      'http://api.test/extension/applications/cand-1/sent',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
