# Abler

| Campo              | Valor                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------- |
| Id do adapter      | `abler`                                                                                   |
| URL base           | https://ats.abler.com.br (páginas por empresa) · https://candidatos.abler.com.br (portal) |
| Decisão            | **investigar**                                                                            |
| `kind` / `fetchBy` | `html` ou `api` · `board` (uma empresa do catálogo `CareerBoard` por vez)                 |
| Modos de envio     | `assisted`                                                                                |
| Rate limit adotado | a definir                                                                                 |
| Consultado em      | 2026-11-19                                                                                |

A Abler é um ATS: cada empresa cliente tem uma página de vagas. O modelo é o mesmo do Greenhouse e do Lever, com `CareerBoard.token` = slug da empresa.

## robots.txt

- https://www.abler.com.br/robots.txt (site institucional): `User-Agent: *` com `Allow: /`.
- https://ats.abler.com.br/robots.txt (páginas de vagas): `User-agent: *` com `Allow: /` e `Sitemap: https://ats.abler.com.br/sitemap.xml`.
- O `robots.txt` de `candidatos.abler.com.br` não foi verificado.

## Termos de uso

https://www.abler.com.br/termos-de-uso

- Não falam de scraping, bots ou coleta automatizada.
- A cláusula 6 proíbe reproduzir o conteúdo e as bases do site "por qualquer meio". A cláusula 2 proíbe copiar ou comercializar a base de candidatos.
- Coletar vagas públicas não é a base de candidatos, mas a cláusula 6 pede uma leitura cuidadosa.
- Os termos das empresas clientes não foram verificados.

## Dados públicos

- Página por empresa: `https://ats.abler.com.br/jobs/<slug-da-empresa>`. Exemplo: `trabalheconosco.abler.com.br` redireciona para `ats.abler.com.br/jobs/trabalheconosco`.
- Portal agregador: `https://candidatos.abler.com.br/vagas`.
- **Sem JSON-LD** na página por empresa (HTML cru de cerca de 1,9 MB, nenhum bloco `application/ld+json`). Provavelmente os dados vêm embutidos num script ou de uma rota JSON. Não verificado.
- Sem API pública documentada.

## Candidatura

Não verificada. Provavelmente um formulário no fluxo da Abler, com cadastro. Só assistida.

## Como construir o adapter

Só depois de descobrir de onde a página tira as vagas:

1. Abra uma página `ats.abler.com.br/jobs/<slug>` no navegador e veja, na aba de rede, se há uma requisição JSON com a lista de vagas.
2. Se houver uma rota JSON estável e pública, use `kind: 'api'` com `fetchBy: 'board'`, como no Lever.
3. Se os dados estiverem só embutidos num script, avalie a estabilidade antes de depender deles.
4. Sem uma fonte estável, rebaixe para "assistido".

## Pendências antes de codar

- [ ] Descobrir a fonte de dados da página por empresa.
- [ ] Ver se o `sitemap.xml` de `ats.abler.com.br` lista as empresas (serviria para semear o catálogo).
- [ ] Reler a cláusula 6 dos termos.
