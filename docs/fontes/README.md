# Fontes de vagas

Uma ficha por site, com a base de uso (API pública, termos, `robots.txt`), o que dá para coletar e como o adapter deve ser construído. Antes de escrever o código de um site, leia a ficha dele e a skill [`adapter-vagas`](../../.claude/skills/adapter-vagas/SKILL.md).

> **Pesquisa de 2026-11-19, só em páginas públicas**, sem login e sem contornar nenhum bloqueio. Nos sites que responderam 403 ou 429, o bloqueio foi registrado e a pesquisa parou ali. Parte dos termos foi lida por resumo ou trecho de busca: a ficha diz quando. **Releia os termos vigentes antes de implementar.**

## Como decidimos

Não existe um worker por site. A ingestão ([ingest.ts](../../apps/workers/src/processors/ingest.ts)) é uma só. O que muda de um site para outro é o **adapter** em `packages/adapters`, e ele só é escrito quando as três condições valem:

1. o `robots.txt` permite as páginas de vaga para `User-agent: *`;
2. os termos de uso não proíbem robôs, crawlers ou coleta automatizada;
3. há dados estruturados para ler: API ou JSON público, ou JSON-LD `JobPosting` na página da vaga.

Se alguma falha, o site fica **só no modo assistido**: a extensão Chrome (Etapa 4) lê a página que o próprio candidato abriu ("salvar vaga de qualquer site") e preenche o formulário, e o candidato envia. Nenhum servidor nosso acessa o site.

A **candidatura** é sempre assistida, inclusive nos sites que coletamos, porque todos exigem a conta do candidato. Login, CAPTCHA e anti-bot nunca são contornados (regra 1 do [AGENTS.md](../../AGENTS.md)).

## Resumo

Legenda da decisão:

- **coletado**: adapter de servidor pronto.
- **coletar**: adapter de servidor a escrever.
- **investigar**: falta confirmar a fonte de dados ou os termos.
- **assistido**: só pela extensão.

| Site                | Decisão      | Como coletar                         | Dados estruturados                            | Prioridade | Ficha                              |
| ------------------- | ------------ | ------------------------------------ | --------------------------------------------- | ---------- | ---------------------------------- |
| Nerdin              | **coletado** | `html` (listagem paginada + JSON-LD) | `JobPosting` confirmado no HTML               | 1          | [nerdin.md](nerdin.md)             |
| ProgramaThor        | **coletado** | `html` (listagem paginada + JSON-LD) | `JobPosting` confirmado no HTML               | 1          | [programathor.md](programathor.md) |
| Solides Vagas       | **coletado** | MCP público oficial (`keyword`)      | MCP testado: busca e detalhe da vaga          | 2          | [solides.md](solides.md)           |
| Abler               | assistido    | —                                    | vagas só numa API interna; sem `JobPosting`   | Etapa 4    | [abler.md](abler.md)               |
| Novo Trampo (TOTVS) | **coletado** | `html` por empresa (`board`)         | `JobPosting` confirmado na página da vaga     | 2          | [novotrampo.md](novotrampo.md)     |
| LinkedIn            | assistido    | —                                    | robots bloqueia tudo; termos proíbem          | Etapa 4    | [linkedin.md](linkedin.md)         |
| Indeed              | assistido    | —                                    | robots bloqueia as vagas; termos proíbem bots | Etapa 4    | [indeed.md](indeed.md)             |
| Glassdoor           | assistido    | —                                    | robots bloqueia as vagas; termos proíbem      | Etapa 4    | [glassdoor.md](glassdoor.md)       |
| Catho               | assistido    | —                                    | 403; API só para integrador aprovado          | Etapa 4    | [catho.md](catho.md)               |
| InfoJobs            | assistido    | —                                    | termos proíbem robôs                          | Etapa 4    | [infojobs.md](infojobs.md)         |
| GeekHunter          | assistido    | —                                    | termos proíbem scraping; Cloudflare           | Etapa 4    | [geekhunter.md](geekhunter.md)     |
| Trampos             | assistido    | —                                    | termos proíbem script e crawler               | Etapa 4    | [trampos.md](trampos.md)           |
| Remotar             | assistido    | —                                    | termos proíbem script e crawler               | Etapa 4    | [remotar.md](remotar.md)           |
| Joinrs              | assistido    | —                                    | termos proíbem cópia; `/api/` bloqueado       | Etapa 4    | [joinrs.md](joinrs.md)             |
| Plooral             | assistido    | —                                    | SPA sem dados públicos; termos não achados    | Etapa 4    | [plooral.md](plooral.md)           |

Os adapters que já existem (Gupy, Greenhouse e Lever) ainda não têm ficha. Crie quando mexer neles.

## Ordem sugerida

1. ~~**Modo `feed` no contrato.**~~ feito: `fetchBy: 'feed'`, com o detalhe da vaga baixado só quando ela é nova ([ADR 0004](../adr/0004-fontes-html-feed-e-detalhe.md)).
2. ~~**Leitor de JSON-LD compartilhado**~~ feito: `json-ld.ts`, `listing-terms.ts` e `listed-job.ts` em `packages/adapters/src`. Um site HTML novo só precisa do parser da listagem.
3. ~~**Respeitar o `robots.txt`**~~ feito: o fetch educado confere o `robots.txt` antes de cada requisição, e um caminho proibido pausa a fonte. A ficha continua registrando o que o arquivo diz, porque a decisão de coletar vem antes do código. Um site de API pública documentada é um contrato; um site HTML é só o que o `robots.txt` deixa.
4. ~~Nerdin → ProgramaThor~~ feitos em 2026-11-19. Investigação de 2026-11-20: Solides (MCP oficial, [ADR 0008](../adr/0008-solides-pelo-mcp-oficial.md)) e TOTVS (por empresa) viraram adapters; a Abler fica no modo assistido.
5. Os sites "assistido" entram com a extensão, na Etapa 4. Lá, o que importa é o mapeamento do formulário de candidatura de cada um (`formMap` no PRD §6.3), não a coleta.

## Modelo de ficha

```markdown
# <Site>

| Campo              | Valor                                             |
| ------------------ | ------------------------------------------------- |
| Id do adapter      | `<id>` (igual ao `Source.id`)                     |
| URL base           | https://...                                       |
| Decisão            | coletar · investigar · assistido                  |
| `kind` / `fetchBy` | `api`/`html`/`browser` · `board`/`keyword`/`feed` |
| Modos de envio     | `assisted`                                        |
| Rate limit adotado | N requisições por minuto                          |
| Consultado em      | AAAA-MM-DD                                        |

## robots.txt

## Termos de uso

## Dados públicos

## Candidatura

## Como construir o adapter (ou: Por que não coletar)

## Pendências antes de codar
```
