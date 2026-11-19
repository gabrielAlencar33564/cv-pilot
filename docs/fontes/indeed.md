# Indeed

| Campo              | Valor                          |
| ------------------ | ------------------------------ |
| Id do adapter      | `indeed`                       |
| URL base           | https://br.indeed.com          |
| Decisão            | **assistido** (confiança alta) |
| `kind` / `fetchBy` | `browser`, só na extensão      |
| Modos de envio     | `assisted`                     |
| Consultado em      | 2026-11-19                     |

## robots.txt

https://br.indeed.com/robots.txt

- `User-agent: *` bloqueia as páginas de vaga (`/viewjob`, `/job/`, `/rc/`), além de `/rss`, `/alert`, `/my/`, `/company/*` e `/rpc/`.
- A busca `/jobs` genérica não é bloqueada para `*`, mas é bloqueada para os bots de treinamento de IA.
- Scrapy e scrapers conhecidos têm `Disallow: /`.

## Termos de uso

https://br.indeed.com/legal, versão de 1º/04/2026. Lidos até cerca de 55% do texto:

- a seção A, item 3.5, proíbe automação, scripts ou bots para se candidatar, exceto pelas ferramentas oficiais da Indeed;
- proíbem extrair o banco de dados;
- o uso de API é limitado e monitorado.

## Dados públicos

A busca respondeu 403 na pesquisa. Não há API de leitura de vagas aberta: só a de vagas patrocinadas, para anunciantes. O RSS está bloqueado.

## Candidatura

Indeed Apply, com conta, ou redirecionamento para o ATS da empresa.

## Por que não coletar

O `robots.txt` bloqueia as páginas de vaga, os termos proíbem candidatura automatizada e a busca responde 403.

## Modo assistido

- "Salvar vaga" pela extensão, na página aberta pelo candidato.
- Preencher o Indeed Apply só como ajuda ao candidato, que envia. Revisar o item 3.5 antes, porque ele pode alcançar até o preenchimento.
- Vaga com redirecionamento: coletar no ATS de origem.

## Reavaliar quando

A Indeed oferecer um programa de parceiro para leitura de vagas.
