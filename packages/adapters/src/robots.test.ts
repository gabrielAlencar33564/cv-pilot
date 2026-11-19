import { describe, expect, it } from 'vitest';
import { isPathAllowed, rulesFor } from './robots';

const permite = (robots: string, caminho: string) =>
  isPathAllowed(rulesFor(robots, 'CVPilotBot'), caminho);

describe('robots.txt', () => {
  it('sem regras, ou com Disallow vazio, tudo é permitido', () => {
    expect(permite('', '/vagas')).toBe(true);
    expect(permite('User-agent: *\nDisallow:\n', '/api/job-search/jobs')).toBe(true);
  });

  it('respeita o Disallow do grupo *', () => {
    const robots = 'User-agent: *\nDisallow: /embed/\n';

    expect(permite(robots, '/embed/job_board')).toBe(false);
    expect(permite(robots, '/v1/boards/gitlab/jobs?content=true')).toBe(true);
  });

  it('o grupo com o nome do bot substitui o *, sem diferenciar maiúsculas', () => {
    const robots = [
      'User-agent: *',
      'Disallow: /',
      '',
      'User-agent: cvpilotbot',
      'Allow: /vagas',
      'Disallow: /',
    ].join('\n');

    expect(permite(robots, '/vagas.php?pagina=2')).toBe(true);
    expect(permite(robots, '/perfil')).toBe(false);
  });

  it('ignora os grupos de outros bots', () => {
    const robots = 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow: /admin/\n';

    expect(permite(robots, '/jobs/1-dev')).toBe(true);
    expect(permite(robots, '/admin/x')).toBe(false);
  });

  it('várias linhas de user-agent seguidas formam um grupo só', () => {
    const robots = 'User-agent: Googlebot\nUser-agent: *\nDisallow: /privado\n';

    expect(permite(robots, '/privado/1')).toBe(false);
  });

  it('vence a regra mais longa, e o Allow ganha no empate', () => {
    const robots = [
      'User-agent: *',
      'Disallow: /vagas',
      'Allow: /vagas/publicas',
      'Disallow: /x',
      'Allow: /x',
    ].join('\n');

    expect(permite(robots, '/vagas/internas')).toBe(false);
    expect(permite(robots, '/vagas/publicas/1')).toBe(true);
    expect(permite(robots, '/x/1')).toBe(true);
  });

  it('entende * e $ nos padrões', () => {
    const robots = 'User-agent: *\nDisallow: /*.pdf$\nDisallow: /*?s=\n';

    expect(permite(robots, '/arquivos/edital.pdf')).toBe(false);
    expect(permite(robots, '/arquivos/edital.pdf?v=2')).toBe(true);
    expect(permite(robots, '/buscar?s=react')).toBe(false);
    expect(permite(robots, '/vagas')).toBe(true);
  });

  it('ignora comentários, campos desconhecidos e regras antes de qualquer user-agent', () => {
    const robots = [
      'Disallow: /tudo',
      '# comentário',
      'User-agent: * # todos',
      'Crawl-delay: 1',
      'Sitemap: https://site.test/sitemap.xml',
      'Disallow: /cron/ # interno',
    ].join('\n');

    expect(permite(robots, '/tudo')).toBe(true);
    expect(permite(robots, '/cron/job')).toBe(false);
  });

  it('o próprio /robots.txt é sempre permitido', () => {
    expect(permite('User-agent: *\nDisallow: /\n', '/robots.txt')).toBe(true);
  });
});
