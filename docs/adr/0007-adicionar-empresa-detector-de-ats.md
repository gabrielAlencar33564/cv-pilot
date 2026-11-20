# ADR 0007: "Adicionar empresa" com detector de ATS no worker e guarda contra SSRF

- **Status:** aceita
- **Data:** 2026-11-19

## Contexto

O catálogo de empresas (`CareerBoard`) só crescia pelo seed ou pelo admin. A ideia de `docs/melhorias.md` (§3.1) é o candidato colar a página de carreiras de uma empresa, o sistema descobrir qual ATS ela usa e incluí-la no catálogo, que vale para todos os usuários.

Dois pontos pesam no desenho:

- **Acessar sites é trabalho dos workers.** A API só enfileira.
- **O endereço vem do usuário.** Visitar uma URL qualquer em nome de alguém abre caminho para SSRF: o bot poderia ser mandado ao Postgres, ao Redis, ao S3 ou aos metadados da nuvem.

## Decisão

- **Cada adapter reconhece os próprios endereços** (`recognize` no `JobSourceAdapter`). O Greenhouse e o Lever devolvem o token da empresa; a Gupy devolve `covered`, porque a busca por palavra-chave já lê todas as empresas dela. O `findAtsInHtml` aplica o mesmo reconhecimento aos links e embeds de uma página.
- **Fluxo:**
  1. `POST /company-suggestions` grava a sugestão (`CompanySuggestion`, do usuário) e enfileira `company-detect`.
  2. O worker tenta reconhecer o próprio endereço. Se não for de um ATS, baixa a página (até 2 MB) e procura os links.
  3. Achou um board: confere na API do ATS que ele existe (404 = não existe) e faz o upsert no catálogo. Um board que o admin desligou continua desligado.
  4. A tela `/empresas` mostra o resultado: `added`, `covered`, `not_detected` ou `unreachable`. Enquanto houver sugestão pendente, ela se atualiza sozinha.
- **Guarda contra SSRF** (`assertPublicUrl`), ligada só no fetch das páginas que vêm do usuário:
  - só http(s), na porta padrão;
  - todos os IPs do nome fora das faixas privadas, de loopback, link-local (metadados da nuvem) e de IPv4 escrito como IPv6;
  - a guarda roda antes de cada requisição, inclusive do `robots.txt`;
  - os redirecionamentos são seguidos um a um pelo fetch educado, até 5, e cada destino passa pela guarda e pelo `robots.txt` dele.
- **O bot continua educado:** identifica-se, respeita o `robots.txt` e faz uma requisição a cada 5 s por host no site da empresa. Num 403 ou num caminho proibido, a sugestão fica `unreachable`, sem nova tentativa.
- **Limite de 20 sugestões por usuário em 24 h**, para o detector não virar um jeito de mandar o bot a dezenas de sites.

## Consequências

- O catálogo cresce sem o admin. A empresa nova é lida na próxima rodada do scheduler para os perfis que buscam naquela fonte.
- **Resta o DNS rebinding:** um nome pode resolver para um IP público na conferência e para um interno na conexão. Fechar isso pede fixar o IP no próprio fetch (um `dispatcher` do undici com `lookup` próprio). Fica registrado como risco conhecido.
- **Páginas montadas por JavaScript** não trazem o link do ATS no HTML, e o detector não roda scripts. A página da GitLab, por exemplo, não é reconhecida. A tela sugere colar o link de uma vaga da empresa, que é reconhecido direto.
- Só os ATS com adapter por board (Greenhouse, Lever e TOTVS) entram no catálogo. A Gupy e a Solides são `covered`. Na conferência com páginas reais, a do Nubank apontou para o Ashby, que ainda não tem adapter. Ashby, SmartRecruiters e outros passam a ser detectados quando ganharem adapter: basta o `recognize`.
- Os boards da região europeia (`*.eu.greenhouse.io`, `*.eu.lever.co`) não são reconhecidos, porque os adapters leem a API da região padrão.
- A sugestão guarda a URL que o usuário colou. Ela sai na exportação de dados (RF-04) e é apagada em cascata com a conta.
