# GeekHunter

| Campo              | Valor                                                |
| ------------------ | ---------------------------------------------------- |
| Id do adapter      | `geekhunter`                                         |
| URL base           | https://www.geekhunter.com (o `.com.br` redireciona) |
| Decisão            | **assistido** (confiança média)                      |
| `kind` / `fetchBy` | `browser`, só na extensão                            |
| Modos de envio     | `assisted`                                           |
| Consultado em      | 2026-11-19                                           |

## robots.txt

https://www.geekhunter.com.br/robots.txt (lido por resumo)

- `User-agent: *` traz sinais de conteúdo (`search=yes, ai-input=yes, ai-train=no`).
- Bloqueia a maior parte do site: áreas de candidato e empresa, `/api/` e `/feeds/`.
- Não ficou claro se as páginas de vaga estão liberadas para `*`.
- O arquivo avisa que o controle real é feito por regras do Cloudflare.

## Termos de uso

https://www.geekhunter.com/pt/termos-de-uso

- Segundo a busca, proíbem scrapers, spiders, crawlers e bots sem autorização escrita.
- Na versão em português, a cláusula aparece dirigida à empresa contratante.
- Não lidos na íntegra.

## Dados públicos

- Listagem: `https://www.geekhunter.com/pt/vagas?page=N`.
- Detalhe: `/pt/<empresa>/jobs/<slug>-<n>`.
- A listagem tem JSON-LD `ItemList` com 25 vagas por página, só nome e URL. **Não tem `JobPosting`.**

## Candidatura

Pela plataforma, com perfil de candidato (o modelo é de recrutamento ativo: as empresas procuram o candidato).

## Por que não coletar

Os termos proíbem scraping, o `robots.txt` é restritivo para `*` e há proteção Cloudflare.

## Modo assistido

"Salvar vaga" pela extensão. Como a GeekHunter funciona por perfil, o ganho maior está em manter o perfil do candidato atualizado lá, o que o candidato faz sozinho.

## Reavaliar quando

Houver autorização por escrito ou uma API.
