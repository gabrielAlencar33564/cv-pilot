# Nerdin

| Campo              | Valor                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------- |
| Id do adapter      | `nerdin`                                                                               |
| URL base           | https://www.nerdin.com.br                                                              |
| Decisão            | **coletar**: adapter `nerdin` desde 2026-11-19                                         |
| `kind` / `fetchBy` | `html` · `feed` (a listagem inteira é um alvo; ver [README](README.md#ordem-sugerida)) |
| Modos de envio     | `assisted`                                                                             |
| Rate limit adotado | 20 requisições por minuto (seed); sem `Crawl-delay`                                    |
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

## Como o adapter funciona

Código em [nerdin/index.ts](../../packages/adapters/src/nerdin/index.ts), com o modo `feed` e o detalhe sob demanda do [ADR 0004](../adr/0004-fontes-html-feed-e-detalhe.md).

1. `fetch()` percorre `vagas.php?pagina=1..N` até uma página sem vagas novas. Cada `div.vaga-card` dá o id (fim do `data-href`), o título sem o selo "Nova", a empresa, o local e os termos do resumo ("PJ • Junior • Híbrido").
2. A ingestão pede a página da vaga (`detail.fetch`) só quando a vaga ainda não está aberta na fonte. Dela sai o `JobPosting` em JSON-LD.
3. `normalize()` usa o card para contrato, nível e modelo, e o JSON-LD para título, empresa, descrição, salário mensal (`baseSalary`, em reais) e data.
   - "Home Office - HO" no endereço vira `remote`, sem cidade.
   - "CLT, PJ" deixa o contrato em branco.
4. A vaga que some da listagem completa é encerrada (RF-34).

Fixtures reais e reduzidas em `nerdin/fixtures/`: uma listagem com três cards e uma vaga.

## Verificações

- [x] Política de privacidade e de cookies lidas em 2026-11-19 (cerca de 3.400 e 2.600 palavras): nenhuma cláusula sobre robôs, scraping, cópia ou automação.
- [x] Tamanho da listagem: 44 páginas de 20 vagas (~900) em 2026-11-19. O teto por execução é de 1.000 vagas.
- [x] Conferido nas páginas reais (três vagas): título, empresa, local, nível, contrato, salário e descrição batem com o site.
- [ ] O `sitemap.xml` não foi olhado. A paginação resolve; ele só serviria para pegar mudanças nas vagas já conhecidas.
