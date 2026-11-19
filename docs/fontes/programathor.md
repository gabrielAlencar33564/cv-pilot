# ProgramaThor

| Campo              | Valor                                                    |
| ------------------ | -------------------------------------------------------- |
| Id do adapter      | `programathor`                                           |
| URL base           | https://programathor.com.br                              |
| Decisão            | **coletar**                                              |
| `kind` / `fetchBy` | `html` · `feed` (ver [README](README.md#ordem-sugerida)) |
| Modos de envio     | `assisted`                                               |
| Rate limit adotado | 10 requisições por minuto                                |
| Consultado em      | 2026-11-19                                               |

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

## Como construir o adapter

1. `fetch()` percorre `/jobs/page/1..N` até uma página sem vagas ou até `ctx.maxResults`, e lê os links `/jobs/<id>-<slug>`.
2. Baixa cada detalhe novo e extrai o `JobPosting` com o leitor de JSON-LD compartilhado.
3. `externalId` = o `<id>` numérico do início do caminho.
4. `normalize()`: o site é só de tecnologia. Use os campos do `JobPosting` e, para a senioridade, o nível que o site mostra (Júnior, Pleno, Sênior) quando ele estiver no JSON-LD; senão `null`.
5. Fixtures: uma listagem e dois detalhes reais, sem dados pessoais.

## Pendências antes de codar

- [ ] Ler os termos na íntegra.
- [ ] Ver o volume da listagem (número de páginas) para o teto por execução.
