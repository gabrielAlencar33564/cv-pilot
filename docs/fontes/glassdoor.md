# Glassdoor

| Campo              | Valor                          |
| ------------------ | ------------------------------ |
| Id do adapter      | `glassdoor`                    |
| URL base           | https://www.glassdoor.com.br   |
| Decisão            | **assistido** (confiança alta) |
| `kind` / `fetchBy` | `browser`, só na extensão      |
| Modos de envio     | `assisted`                     |
| Consultado em      | 2026-11-19                     |

Agregador do mesmo grupo da Indeed. Parte das vagas usa o Indeed Apply.

## robots.txt

https://www.glassdoor.com.br/robots.txt

- `User-agent: *` bloqueia:
  - o detalhe e a paginação das vagas: `/job-listing/...`, `/jobview/`, `/Vaga/*_IP*` e `/Vagas/*_P*.htm*`;
  - `/api/`, `/search/`, `/member/` e `/profile/`.
- Bots de IA têm bloqueio quase total.

## Termos de uso

https://www.glassdoor.com/about/terms.htm. Não lidos na íntegra; as versões anteriores e os resumos indicam:

- proibição de robôs, spiders e scrapers sem permissão escrita;
- restrição ao uso comercial dos dados.

## Dados públicos

A listagem respondeu 403. Sem API pública de vagas.

## Por que não coletar

O `robots.txt` bloqueia as vagas e os termos proíbem robôs.

## Modo assistido

"Salvar vaga" pela extensão. A candidatura costuma ir para o Indeed Apply (ver [indeed.md](indeed.md)) ou para o site da empresa.

## Reavaliar quando

Houver permissão por escrito. Não é provável.
