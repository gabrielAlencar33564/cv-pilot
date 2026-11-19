# Remotar

| Campo              | Valor                           |
| ------------------ | ------------------------------- |
| Id do adapter      | `remotar`                       |
| URL base           | https://remotar.com.br          |
| Decisão            | **assistido** (confiança média) |
| `kind` / `fetchBy` | `browser`, só na extensão       |
| Modos de envio     | `assisted`                      |
| Consultado em      | 2026-11-19                      |

Agregador de vagas remotas que aponta para o site de cada empresa.

## robots.txt

`/robots.txt` respondeu 404, tanto com quanto sem `www`: não há regras.

## Termos de uso

https://remotar.com.br/termos-de-uso proíbe:

- scripts e mecanismos automatizados;
- cópia por "Robot/Crawler";
- reprodução do conteúdo sem autorização;
- sobrecarga da infraestrutura.

## Dados públicos

- Detalhe: `https://remotar.com.br/job/<id>/<empresa>/<titulo>`.
- A home é uma SPA, com o conteúdo carregado no cliente.
- JSON-LD e API não verificados.

## Candidatura

Varia por vaga: redirecionamento para o site da empresa, e-mail (às vezes com assunto obrigatório) ou nenhuma instrução.

## Por que não coletar

Os termos proíbem scripts e crawlers. Sem `robots.txt`, não há permissão explícita: valem os termos.

## Modo assistido

- "Salvar vaga" pela extensão.
- Quando a vaga leva a um ATS conhecido (Greenhouse, Lever, Gupy...), a empresa pode entrar no catálogo (`CareerBoard`) pelo "Adicionar empresa" (melhorias §3.1). A coleta passa a ser na origem, com permissão.
- Quando a vaga pede e-mail, ela é candidata ao modo de envio `email` (Etapa 4), com o assunto que a vaga exigir.

## Reavaliar quando

Houver autorização ou uma API.
