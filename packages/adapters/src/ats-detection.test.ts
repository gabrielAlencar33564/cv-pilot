import { describe, expect, it } from 'vitest';
import { findAtsInHtml, recognizeAtsUrl } from './registry';

describe('recognizeAtsUrl', () => {
  it.each([
    ['https://boards.greenhouse.io/nubank', 'greenhouse', 'nubank'],
    ['https://boards.greenhouse.io/Nubank/jobs/123?gh_src=x', 'greenhouse', 'nubank'],
    ['https://job-boards.greenhouse.io/gitlab', 'greenhouse', 'gitlab'],
    ['https://boards.greenhouse.io/embed/job_board?for=stone', 'greenhouse', 'stone'],
    ['https://boards.greenhouse.io/embed/job_board/js?for=stone', 'greenhouse', 'stone'],
    ['https://boards-api.greenhouse.io/v1/boards/vtex/jobs', 'greenhouse', 'vtex'],
    ['https://jobs.lever.co/leverdemo', 'lever', 'leverdemo'],
    ['https://jobs.lever.co/leverdemo/5ac21346-8e0c-4494', 'lever', 'leverdemo'],
    ['https://api.lever.co/v0/postings/leverdemo?mode=json', 'lever', 'leverdemo'],
  ])('%s é o board %s/%s', (href, sourceId, token) => {
    expect(recognizeAtsUrl(href)).toEqual({ kind: 'board', sourceId, token });
  });

  it('página de empresa na Gupy já é coberta pela busca por palavra-chave', () => {
    expect(recognizeAtsUrl('https://empresa.gupy.io/jobs/123')).toEqual({
      kind: 'covered',
      sourceId: 'gupy',
    });
  });

  it.each([
    ['site da própria empresa', 'https://empresa.com.br/carreiras'],
    ['região europeia do Lever, que a API do adapter não lê', 'https://jobs.eu.lever.co/x'],
    ['domínio que só termina parecido', 'https://boards.greenhouse.io.golpe.com/x'],
    ['board sem token', 'https://boards.greenhouse.io/'],
    ['token fora do formato', 'https://jobs.lever.co/%3Cscript%3E'],
    ['outro protocolo', 'ftp://jobs.lever.co/x'],
    ['texto que não é URL', 'jobs.lever.co/x'],
  ])('não reconhece: %s', (_caso, href) => {
    expect(recognizeAtsUrl(href)).toBeNull();
  });
});

describe('findAtsInHtml', () => {
  it('acha o board em links, embeds e JSON com barras escapadas, sem repetir', () => {
    const html = `
      <a href="https://boards.greenhouse.io/stone/jobs/1">Vaga 1</a>
      <a href="https://boards.greenhouse.io/stone/jobs/2">Vaga 2</a>
      <script src="https://boards.greenhouse.io/embed/job_board/js?for=stone&amp;b=x"></script>
      <script>window.cfg = {"careers":"https:\\/\\/jobs.lever.co\\/outra"}</script>`;

    expect(findAtsInHtml(html)).toEqual([
      { kind: 'board', sourceId: 'greenhouse', token: 'stone' },
      { kind: 'board', sourceId: 'lever', token: 'outra' },
    ]);
  });

  it('página sem ATS conhecido não devolve nada', () => {
    expect(findAtsInHtml('<a href="https://empresa.com/vagas">Vagas</a>')).toEqual([]);
  });
});
