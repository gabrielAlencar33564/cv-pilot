# ProgramaThor

| Campo              | Valor                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Id do adapter      | `programathor`                                                                                                               |
| URL base           | https://programathor.com.br                                                                                                  |
| Decisão            | **coletar**: adapter `programathor` desde 2026-11-19                                                                         |
| `kind` / `fetchBy` | `html` · `feed` (ver [README](README.md#ordem-sugerida))                                                                     |
| Modos de envio     | `assisted`                                                                                                                   |
| Rate limit adotado | 10 requisições por minuto (seed). O site está atrás do Cloudflare e respondeu 429, sem `Retry-After`, a uma rajada de testes |
| Consultado em      | 2026-11-19                                                                                                                   |

## robots.txt

https://programathor.com.br/robots.txt

- `User-agent: *` com `Disallow: /admin/`, `/user/`, `/users/` e `/company/`.
- **`/jobs` é permitido.** As páginas de perfil de usuário ficam fora de qualquer coleta.
- Sem `Crawl-delay`. Nada específico para bots de IA.
- `Sitemap: https://programathor.com.br/sitemap.xml`.

## Termos de uso

https://programathor.com.br/terms

- Não mencionam scraping, bots ou crawlers de forma explícita.
- A seção 7.5 restringe o uso de dados obtidos "via API, integrações com ATS" ao que os termos permitem.
- A ausência de proibição de candidatura automatizada vem de uma leitura resumida: **ler o texto integral** antes de implementar.

## Dados públicos

- Listagem: `https://programathor.com.br/jobs`.
  - Paginação: `/jobs/page/N`.
  - Filtros: `?contract_type=CLT`, `?remoto=true`, `?expertise=Pleno`.
  - Também há `/jobs-<skill>` e `/jobs-city/<cidade>`.
- Detalhe: `https://programathor.com.br/jobs/<id>-<slug>`.
- **JSON-LD `JobPosting` confirmado** no HTML cru de uma vaga, junto com `Organization`, `BreadcrumbList` e `WebSite`.
- O sitemap tem só uma amostra (cerca de 30 vagas com `lastmod`), então não serve como catálogo.
- Sem API nem RSS.

## Candidatura

No próprio site, com conta: o botão "Quero me candidatar" leva ao cadastro (`/users/sign_up`). Só assistida.

## Como o adapter funciona

Código em [programathor/index.ts](../../packages/adapters/src/programathor/index.ts), com o modo `feed` e o detalhe sob demanda do [ADR 0004](../adr/0004-fontes-html-feed-e-detalhe.md).

1. `fetch()` lê `/jobs` e depois `/jobs/page/N`, até uma página sem vagas novas. Cada card (`div.cell-list > a`) dá o id (início do caminho), o título e os spans com ícone: empresa, local, porte, nível e contrato.
2. A ingestão pede a página da vaga (`detail.fetch`) só quando a vaga ainda não está aberta na fonte. Dela sai o `JobPosting` em JSON-LD, com a descrição em HTML.
3. `normalize()` usa o card para contrato, nível e modelo ("Remoto" no lugar do local vira `remote`), e o JSON-LD para título, empresa, descrição (convertida em texto) e data.
4. A vaga que some da listagem completa é encerrada (RF-34).

Fixtures reais e reduzidas em `programathor/fixtures/`: uma listagem com três cards (sem as imagens, que vinham com URLs assinadas) e uma vaga.

## Verificações

- [x] Termos lidos na íntegra em 2026-11-19 (cerca de 2.500 palavras). Tratam de conta, empresa, pagamento e LGPD, e nada falam de robôs ou coleta automatizada. O item 4.7 prevê a divulgação das vagas em plataformas parceiras.
- [x] Tamanho da listagem: a página 3 já vem vazia, então são duas páginas de 15 (~30 vagas) em 2026-11-19.
- [x] Conferido nas páginas reais (três vagas): título, empresa, nível, contrato, modelo e descrição batem com o site.
