import { describe, expect, it } from 'vitest';
import { jobFromPage } from './job-from-page';
import type { PageSnapshot } from './read-page';

const pagina = (o: Partial<PageSnapshot> = {}): PageSnapshot => ({
  url: 'https://www.vagas.exemplo.test/123',
  title: 'Dev React | Exemplo Vagas',
  jsonLd: [],
  ogTitle: null,
  siteName: null,
  h1: null,
  metaDescription: null,
  ...o,
});

const posting = {
  '@context': 'https://schema.org',
  '@type': 'JobPosting',
  title: 'Engenheira de Dados',
  hiringOrganization: { '@type': 'Organization', name: 'Dados &amp; Cia' },
  jobLocation: { '@type': 'Place', address: { addressLocality: 'São Paulo', addressRegion: 'SP' } },
  description: '<p>Vaga de <b>Python</b>.</p><ul><li>Spark</li><li>SQL &amp; dbt</li></ul>',
};

describe('jobFromPage', () => {
  it('lê o JobPosting do JSON-LD, com a descrição em texto', () => {
    expect(jobFromPage(pagina({ jsonLd: [JSON.stringify(posting)] }))).toEqual({
      url: 'https://www.vagas.exemplo.test/123',
      title: 'Engenheira de Dados',
      company: 'Dados & Cia',
      location: 'São Paulo, SP',
      description: 'Vaga de Python.\nSpark\nSQL & dbt',
      structured: true,
    });
  });

  it('acha a vaga dentro de @graph e de listas, e ignora blocos quebrados', () => {
    const ld = [
      '{ isto não é json',
      JSON.stringify([
        { '@type': 'WebSite' },
        { '@graph': [{ ...posting, '@type': ['JobPosting'] }] },
      ]),
    ];

    expect(jobFromPage(pagina({ jsonLd: ld }))).toMatchObject({
      title: 'Engenheira de Dados',
      structured: true,
    });
  });

  it('vaga remota vira "Remoto"', () => {
    const remota = { ...posting, jobLocationType: 'TELECOMMUTE' };

    expect(jobFromPage(pagina({ jsonLd: [JSON.stringify(remota)] })).location).toBe('Remoto');
  });

  it('sem JSON-LD, usa o h1, o nome do site e a descrição da página', () => {
    expect(
      jobFromPage(
        pagina({ h1: 'Dev React Pleno', siteName: 'Acme Carreiras', metaDescription: 'Venha!' }),
      ),
    ).toEqual({
      url: 'https://www.vagas.exemplo.test/123',
      title: 'Dev React Pleno',
      company: 'Acme Carreiras',
      location: null,
      description: 'Venha!',
      structured: false,
    });
  });

  it('sem nada além do título da aba, tira o nome do site e usa o domínio como empresa', () => {
    expect(jobFromPage(pagina())).toMatchObject({
      title: 'Dev React',
      company: 'vagas.exemplo.test',
    });
  });
});
