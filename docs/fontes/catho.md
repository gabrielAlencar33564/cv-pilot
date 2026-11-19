# Catho

| Campo              | Valor                                            |
| ------------------ | ------------------------------------------------ |
| Id do adapter      | `catho`                                          |
| URL base           | https://www.catho.com.br                         |
| Decisão            | **assistido** (confiança média-baixa: reavaliar) |
| `kind` / `fetchBy` | `browser`, só na extensão                        |
| Modos de envio     | `assisted`                                       |
| Consultado em      | 2026-11-19                                       |

## robots.txt

https://www.catho.com.br/robots.txt

- `User-agent: *` bloqueia `/buscar/vagas/` e as URLs com query string (`?s=`, `?q=`, parâmetros de campanha).
- Bloqueia também a área da empresa e a biblioteca.
- Termina com `Allow: /`. As vagas ficam em `/vagas-emprego/<empresa>/<id>` e não são bloqueadas no geral.
- Bots de IA têm `Allow` total.
- `Sitemap: https://www.catho.com.br/sitemap-index.xml`.

## Termos de uso

- A página de termos não foi localizada (`/termos-de-uso` deu 404).
- Existe um documento de "termos das APIs públicas" da Catho para **integradores**, com token concedido pelo usuário final. É uma API de integração com consentimento, não uma API aberta de vagas.

## Dados públicos

A listagem `/vagas/` respondeu 403 na pesquisa. JSON-LD não verificado.

## Por que não coletar (por ora)

Recebemos 403, não achamos os termos e a API oficial depende de aprovação. O `robots.txt` em si não proíbe as páginas de vaga.

## Modo assistido

"Salvar vaga" e preencher o formulário pela extensão. O candidato envia.

## Reavaliar quando

- Localizar e ler os termos do site.
- Perguntar à Catho sobre o programa de integradores. A API com token do usuário pode viabilizar, com consentimento, até o acompanhamento das candidaturas.
- Testar se as páginas `/vagas-emprego/...` respondem sem desafio a um User-Agent identificado e se têm JSON-LD.
