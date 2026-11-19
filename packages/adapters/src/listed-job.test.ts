import { describe, expect, it } from 'vitest';
import { normalizeListedJob, type ListedJob } from './listed-job';

const listada = (o: Partial<ListedJob> = {}): ListedJob => ({
  id: '1',
  url: 'https://site.test/vagas/1',
  title: 'Dev',
  company: 'Empresa X',
  location: null,
  terms: [],
  ...o,
});

describe('normalizeListedJob', () => {
  it('"Home Office" no endereço do JobPosting é o modelo de trabalho, não uma cidade', () => {
    // caso real da Nerdin: addressLocality "Home Office", addressRegion "HO"
    const vaga = normalizeListedJob(
      'nerdin',
      listada({
        posting: {
          title: 'Dev',
          description: '',
          jobLocation: { address: { addressLocality: 'Home Office', addressRegion: 'HO' } },
        },
      }),
    );

    expect(vaga).toMatchObject({ location: null, workModel: 'remote' });
  });

  it('o mesmo vale para o local do card', () => {
    expect(normalizeListedJob('nerdin', listada({ location: 'Remoto' }))).toMatchObject({
      location: null,
      workModel: 'remote',
    });
  });

  it('uma cidade continua como local', () => {
    expect(normalizeListedJob('nerdin', listada({ location: 'Itu - SP' }))).toMatchObject({
      location: 'Itu - SP',
      workModel: null,
    });
  });
});
