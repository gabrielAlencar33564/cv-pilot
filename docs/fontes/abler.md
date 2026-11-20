# Abler

| Campo              | Valor                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------- |
| Id do adapter      | —                                                                                         |
| URL base           | https://ats.abler.com.br (páginas por empresa) · https://candidatos.abler.com.br (portal) |
| Decisão            | **assistido** (sem fonte de dados pública e estável)                                      |
| `kind` / `fetchBy` | —                                                                                         |
| Modos de envio     | `assisted`                                                                                |
| Rate limit adotado | —                                                                                         |
| Consultado em      | 2026-11-19 (fonte de dados investigada em 2026-11-20)                                     |

A Abler é um ATS: cada empresa cliente tem uma página de vagas em `ats.abler.com.br/jobs/<slug>`.

## robots.txt

- `ats.abler.com.br`, `candidatos.abler.com.br` e `www.abler.com.br`: `User-agent: *` com `Allow: /`.
- `hulk-smash.abler.com.br` (a API interna, ver abaixo): também `Allow: /`.

## Termos de uso

https://www.abler.com.br/termos-de-uso

- Não falam de scraping, bots ou coleta automatizada.
- A cláusula 6 proíbe reproduzir o conteúdo e as bases do site "por qualquer meio". A cláusula 2 proíbe copiar ou comercializar a base de candidatos.

## Dados públicos

- **Página por empresa** (`ats.abler.com.br/jobs/<slug>`): cerca de 1,9 MB de HTML (Nuxt). O estado embutido (`window.__NUXT__`) só traz o cabeçalho da página. **As vagas são carregadas no navegador**, de `https://hulk-smash.abler.com.br/api`.
- **Página da vaga** (`/jobs/<empresa>/?slug=<vaga>`): o JSON-LD é só institucional (`Organization`, `WebSite`, `SoftwareApplication`, `WebPage`). **Não há `JobPosting`.**
- **API `hulk-smash`:** interna e sem documentação. O nome não indica um contrato público, e as rotas só aparecem nos scripts do site.
- O `sitemap.xml` de `ats.abler.com.br` lista cerca de 13 mil endereços (empresas e vagas).

## Decisão

**Só no modo assistido.** A condição 3 de [README.md](README.md) não vale: não há API pública nem JSON-LD `JobPosting`. Depender da API interna seria frágil, porque ela muda sem aviso. Também esbarraria na cláusula 6 dos termos. Coletar o HTML não adianta, porque as vagas não estão nele.

O caminho para virar fonte coletada é uma parceria com a Abler (API ou feed oficial), não a engenharia reversa da API interna.

## Candidatura

Pelo fluxo da Abler, com cadastro do candidato. Assistida, pela extensão (Etapa 4).
