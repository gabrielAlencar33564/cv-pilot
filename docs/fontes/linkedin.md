# LinkedIn

| Campo              | Valor                                                 |
| ------------------ | ----------------------------------------------------- |
| Id do adapter      | `linkedin` (já no seed, com `active: false`)          |
| URL base           | https://www.linkedin.com/jobs                         |
| Decisão            | **assistido** (confiança alta)                        |
| `kind` / `fetchBy` | `browser`, só na extensão; nenhuma coleta de servidor |
| Modos de envio     | `assisted`                                            |
| Consultado em      | 2026-11-19                                            |

## robots.txt

https://www.linkedin.com/robots.txt

- O próprio arquivo avisa que o acesso automatizado não autorizado é proibido. Pedidos de permissão vão para um e-mail de whitelist.
- **`User-agent: *` tem `Disallow: /`.**
- Os buscadores autorizados também não acessam `/jobs-guest/`, `/job-apply/`, `/jobs/view/externalApply/` nem `/api/jobPostings/`.

## Termos de uso

https://www.linkedin.com/legal/user-agreement, seção 8.2. Proíbem explicitamente:

- software, scripts, bots, crawlers **e plugins de navegador** para raspar ou copiar o serviço;
- automação para acessar, enviar mensagens ou interagir;
- contornar limites de uso.

## Dados públicos

A Job Posting API (Talent Solutions) é **restrita a parceiros aprovados** e serve para publicar vagas, não para ler as de terceiros. A busca pública respondeu 429 na pesquisa.

## Candidatura

- "Easy Apply" no LinkedIn, que exige login.
- Ou redirecionamento para o ATS da empresa. Nesse caso, a vaga pode ser coletada na origem (Greenhouse, Lever, Gupy...).

## Por que não coletar

O `robots.txt` bloqueia tudo, e os termos vedam até plugins de navegador que copiem dados. É o caso mais restrito da lista (PRD §9).

## Modo assistido

- A extensão **não raspa listagens**. Ela age só na página de vaga que o candidato abriu, por um clique dele ("salvar esta vaga"), e lê o mínimo para a vaga entrar no funil: título, empresa, link.
- No "Easy Apply", a extensão preenche com o perfil do candidato **e o candidato envia**. Mesmo esse preenchimento deve ser revisto contra a seção 8.2 antes de lançar: na dúvida, só "salvar vaga" e "abrir o link de candidatura".
- Quando a vaga leva ao ATS da empresa, prefira o adapter do ATS.

## Reavaliar quando

Houver uma parceria oficial (Talent Solutions) ou permissão por escrito.
