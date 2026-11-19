# InfoJobs

| Campo              | Valor                           |
| ------------------ | ------------------------------- |
| Id do adapter      | `infojobs`                      |
| URL base           | https://www.infojobs.com.br     |
| Decisão            | **assistido** (confiança média) |
| `kind` / `fetchBy` | `browser`, só na extensão       |
| Modos de envio     | `assisted`                      |
| Consultado em      | 2026-11-19                      |

## robots.txt

https://www.infojobs.com.br/robots.txt (lido no HTML cru)

- `User-agent: *` bloqueia páginas estáticas e de conta: `/static/...`, `/VisualizarCV.aspx`, `/Candidato-CV-Visualizar.aspx`, `/RecordarClave.aspx`, `/OfertaEnviarAmigo.aspx`.
- **As páginas de vaga não são bloqueadas.**

## Termos de uso

Lidos por trechos de busca:

- https://www.infojobs.com.br/legal/aviso-legal-para-candidatos__15727.aspx
- https://m.infojobs.com.br/legalterms.aspx

Proíbem:

- acesso e leitura por bots e programas automáticos;
- cópia por "Robot/Crawler";
- scripts e sobrecarga da infraestrutura;
- reprodução do conteúdo e das bases sem autorização.

## Dados públicos

- Listagem: `https://www.infojobs.com.br/vagas-de-emprego.aspx`.
- Detalhe: `/vaga-de-<titulo>-em-<cidade>__<id>.aspx`.
- JSON-LD não verificado. Sem API nem RSS.

## Candidatura

No próprio site, com conta.

## Por que não coletar

O `robots.txt` deixaria, mas os termos proíbem robôs explicitamente. Vale o mais restritivo dos dois.

## Modo assistido

"Salvar vaga" e preencher o formulário pela extensão. O candidato envia.

## Reavaliar quando

O InfoJobs (Redarbor) oferecer API ou parceria. A Pandapé, ATS do mesmo grupo, pode ter páginas de carreira por empresa a investigar.
