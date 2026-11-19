# Nerdin

| Campo              | Valor                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------- |
| Id do adapter      | `nerdin`                                                                               |
| URL base           | https://www.nerdin.com.br                                                              |
| Decisão            | **coletar**                                                                            |
| `kind` / `fetchBy` | `html` · `feed` (a listagem inteira é um alvo; ver [README](README.md#ordem-sugerida)) |
| Modos de envio     | `assisted`                                                                             |
| Rate limit adotado | 10 requisições por minuto (site pequeno; sem `Crawl-delay`)                            |
| Consultado em      | 2026-11-19                                                                             |

## robots.txt

https://nerdin.com.br/robots.txt

- `User-agent: *` com `Allow: /`.
- Bloqueia áreas internas (`/nadm*`, `/config/`, `/cache/`, `/cron/`, `/login_*`) e páginas de conta ou empresa (`/cadastro_vaga.php`, `/empresa_vagas.php`, `/vagas_candidato.php`).
- Bloqueia **`/vaga_candidatura.php`**: o formulário de candidatura fica fora de qualquer automação.
- A listagem (`/vagas.php`) e o detalhe (`/vaga_emprego/...`) são permitidos.
- Sem `Crawl-delay`. `Sitemap: https://www.nerdin.com.br/sitemap.xml`.

## Termos de uso

Não há termos gerais públicos. O único "Termo de Uso e Adesão" (`candidato_termo_plano_premium.php`) é o do plano premium do candidato. Há política de privacidade e de cookies no rodapé, ainda **não lidas**.

## Dados públicos

- Listagem: `https://www.nerdin.com.br/vagas.php?pagina=N`.
  - Filtros: `vagas-<categoria>.php`, `?Plataforma=`, `?Especialidade=`, `?Cargo=`.
  - Cada item traz título, contrato, nível, modelo de trabalho, salário, empresa, local e data.
- Detalhe: `https://www.nerdin.com.br/vaga_emprego/vaga-<slug>-<id>.php`.
- **JSON-LD `JobPosting` confirmado** no HTML cru de uma vaga (resposta 200, 3 blocos `application/ld+json`).
- Sem API nem RSS.

## Candidatura

- No próprio site, pelo botão "Enviar candidatura" (`vaga_candidatura.php?id=<id>`). Provavelmente exige conta.
- O caminho está no `Disallow`: candidatura só assistida.

## Como construir o adapter

1. `fetch()` percorre `vagas.php?pagina=1..N` até uma página sem vagas ou até `ctx.maxResults`, e lê os links `vaga_emprego/...` de cada página.
2. Para cada link novo, baixa o detalhe e extrai o `JobPosting` com o leitor de JSON-LD compartilhado.
3. `externalId` = o `<id>` numérico do fim da URL.
4. `normalize()`:
   - `workModel` e `contractType` vêm do JSON-LD (`jobLocationType: TELECOMMUTE` → `remote`; `employmentType`);
   - salário de `baseSalary`, quando houver;
   - na dúvida, `null`.
5. Fixtures: uma página de listagem e dois detalhes reais (um remoto, um presencial), reduzidos e sem dados pessoais.

## Pendências antes de codar

- [ ] Ler a política de privacidade e a de cookies em busca de cláusula sobre robôs.
- [ ] Confirmar quantas páginas a listagem tem, para calibrar o teto por execução.
- [ ] Ver se o `sitemap.xml` lista as vagas com `lastmod`. Se listar, dá para ler o sitemap em vez de paginar.
