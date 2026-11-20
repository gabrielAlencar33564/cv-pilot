# Novo Trampo (TOTVS Atração de Talentos)

| Campo              | Valor                                                                                |
| ------------------ | ------------------------------------------------------------------------------------ |
| Id do adapter      | `totvs` (o ATS por trás, não o portal)                                               |
| URL base           | https://atracaodetalentos.totvs.app (vagas) · https://www.novotrampo.com.br (portal) |
| Decisão            | **coletado**, por empresa                                                            |
| `kind` / `fetchBy` | `html` · `board` (uma empresa do catálogo por vez), com `detail` pelo JSON-LD        |
| Modos de envio     | `assisted`                                                                           |
| Rate limit adotado | 20 requisições por minuto                                                            |
| Consultado em      | 2026-11-19 (fonte de dados e termos em 2026-11-20)                                   |

O Novo Trampo é o portal agregador da plataforma "Atração de Talentos" da TOTVS. As vagas moram em `atracaodetalentos.totvs.app/<empresa>/<id>/<slug>`. O adapter lê o ATS por empresa, não o portal.

## robots.txt

- `www.novotrampo.com.br`: só um grupo, para `User-Agent: Grapeshot`. Para os outros, nenhuma restrição.
- `atracaodetalentos.totvs.app`: também só o grupo `Grapeshot` (bloqueia `/@po-ui/`, `/images/` e `/fonts/` para ele). Nenhuma restrição para `User-agent: *`. `Sitemap: https://atracaodetalentos.totvs.app/sitemap.xml`.

## Termos de uso

"Termos de uso do Novo Trampo", atualizados em 04/02/2026 ([PDF](https://centraldocandidato.totvs.app/assets/files/terms-of-use/novo-trampo/v1.pdf)), lidos na íntegra em 2026-11-20.

- O site existe só para divulgar vagas e redireciona o candidato ao ATS para se candidatar (1.1, 2.1 e 2.3).
- **Não falam de robôs, scraping, crawlers nem cópia de conteúdo.**
- O usuário se compromete a usar o site para fins lícitos (3.2). A TOTVS pode restringir o acesso em caso de uso indevido (4.1).
- As páginas do ATS (`atracaodetalentos.totvs.app`) não têm termos próprios. Só trazem o link da política de privacidade de cada empresa.

## Dados públicos

- **Página da empresa** (`atracaodetalentos.totvs.app/<empresa>`):
  - HTML renderizado no servidor, com todas as vagas abertas;
  - cada vaga é um link `a.index__job-opportunity-name` para `/<empresa>/<id>/<slug>`;
  - o elemento pai tem `data-title`, `data-code` (o id) e atributos de local e modelo;
  - exemplo: `eureciclo`, com 7 vagas.
- **Página da vaga**: tem JSON-LD **`JobPosting`** completo:
  - `title`, `description` (HTML), `datePosted`, `validThrough`, `employmentType`, `hiringOrganization.name` e `jobLocation.address`;
  - o bloco termina com um `;` depois do objeto, que o leitor de JSON-LD precisa tolerar.
- **Sitemap do ATS**: cerca de 7 mil endereços, sendo cerca de 700 páginas de empresa e cerca de 6.250 vagas. Serve para semear o catálogo.
- **Portal Novo Trampo** (`/vagas/N`): 9 vagas por página e mais de 500 páginas. Depois da última, a numeração volta à primeira. É grande demais para o modo `feed`, e por isso o adapter é por empresa.

## Candidatura

Pela Central do Candidato da TOTVS (`centraldocandidato.totvs.app`), com conta. Só assistida.

## Como construir o adapter

1. `fetchBy: 'board'`: `CareerBoard.token` = slug da empresa. O `fetch` lê a página da empresa e devolve os cards da listagem.
2. `detail`: a página da vaga só para as vagas novas, lida pelo `json-ld.ts`, que precisa aceitar o `;` no fim do bloco. Use `listedJobDetail` e `normalizeListedJob` de `listed-job.ts`.
3. `externalId` = `<empresa>:<id>`, porque o id só é único dentro da empresa.
4. `recognize`: `atracaodetalentos.totvs.app/<empresa>` é o board `<empresa>`. Assim, o "Adicionar empresa" já inclui empresas da TOTVS no catálogo.
5. Semear o catálogo de dev com uma empresa de exemplo.
