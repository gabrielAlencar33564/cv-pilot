# Joinrs

| Campo              | Valor                                            |
| ------------------ | ------------------------------------------------ |
| Id do adapter      | `joinrs`                                         |
| URL base           | https://www.joinrs.com/pt/job-offers/            |
| Decisão            | **assistido** (confiança média-baixa: reavaliar) |
| `kind` / `fetchBy` | `browser`, só na extensão                        |
| Modos de envio     | `assisted`                                       |
| Consultado em      | 2026-11-19                                       |

## robots.txt

https://joinrs.com/robots.txt

- `User-Agent: *` com `Allow: /`.
- Bloqueia mensagens, configurações, autenticação, painel administrativo, rastreamento e **`/api/`**.
- `/pt/job-offers/` não é bloqueado.
- `Sitemap: https://www.joinrs.com/sitemap.xml`, com 23 sitemaps de vagas atualizados no dia da consulta.

## Termos de uso

https://www.joinrs.com/pt/terms-and-conditions

- Não citam scraping nem bots.
- Proíbem copiar, baixar ou criar obras derivadas do portal ou do conteúdo sem autorização escrita (cláusulas 2, 4.1 e 4.6).
- Numa leitura estrita, isso alcança a coleta automatizada.

## Dados públicos

Há sitemaps de vagas. O formato das URLs de vaga e o JSON-LD não foram verificados. A API interna é bloqueada para robôs.

## Candidatura

Não verificada. O fluxo parte do envio do currículo e de uma conta.

## Por que não coletar (por ora)

A cláusula de cópia dos termos é ampla, e o risco jurídico não compensa antes de termos fontes mais limpas.

## Reavaliar quando

- Pedir autorização à Joinrs.
- Ou, com aceite explícito do risco, confirmar o JSON-LD numa página de vaga real e usar os sitemaps. O adapter seria `html` com `fetchBy: 'feed'`.
