# Trampos

| Campo              | Valor                                |
| ------------------ | ------------------------------------ |
| Id do adapter      | `trampos`                            |
| URL base           | https://trampos.co                   |
| Decisão            | **assistido** (confiança média-alta) |
| `kind` / `fetchBy` | `browser`, só na extensão            |
| Modos de envio     | `assisted`                           |
| Consultado em      | 2026-11-19                           |

## robots.txt

https://trampos.co/robots.txt

- `User-agent: *` só bloqueia `/admin/`. Todo o resto é permitido.
- `Sitemap: https://trampos.co/sitemaps/sitemap.xml.gz`.

## Termos de uso

https://trampos.co/legal/termos-uso-condicoes-legais

- A seção 2.5 veda mecanismos, software ou scripts para interagir com o site, cópia por "Robot/Crawler" e sobrecarga da infraestrutura.
- A seção 4.3 permite bloquear contas que se candidatam "de forma massiva".

## Dados públicos

Listagem em `https://trampos.co/oportunidades` e sitemap compactado. O padrão das URLs de vaga e o JSON-LD não foram verificados.

## Por que não coletar

Os termos proíbem scripts e crawlers, e a candidatura em massa leva a bloqueio de conta. O `robots.txt` aberto não muda isso: vale o mais restritivo.

## Modo assistido

"Salvar vaga" e preencher o formulário pela extensão, uma candidatura por vez, sempre enviada pelo candidato. Respeite o limite diário do perfil, por causa da seção 4.3.

## Reavaliar quando

Houver autorização ou uma API.
