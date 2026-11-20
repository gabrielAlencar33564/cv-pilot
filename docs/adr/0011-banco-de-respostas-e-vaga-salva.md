# ADR 0011: Banco de respostas e "salvar vaga de qualquer site" pela extensão

- **Status:** aceita
- **Data:** 2026-11-20

## Contexto

Com a extensão do modo assistido ([ADR 0010](0010-extensao-com-token-proprio.md)), dois buracos ficaram claros:

- **Perguntas dos formulários.** Cada site pergunta coisas próprias ("Possui CNH?", "Quanto tempo de experiência com Python?"). As respostas padrão da regra de envio cobrem um site de cada vez, e o candidato não sabe com antecedência o que vai ser perguntado. É o que mais consome tempo no modo assistido (§3.2 de `docs/melhorias.md`).
- **Vagas fora das fontes.** O candidato acha vagas no LinkedIn, no Indeed ou no site da empresa, onde o CV Pilot não busca, e elas ficavam fora do funil.

## Decisão

**Banco de respostas**

- Tabela `SavedAnswer` por usuário: a pergunta como apareceu, a chave normalizada, a resposta (null até o candidato responder), quantas vezes apareceu e quando.
- A chave é o `questionKey` do `core`: sem acento, sem pontuação, sem "(obrigatório)", em minúsculas. A mesma pergunta em outro site cai na mesma linha (`@@unique([userId, questionKey])`). Se o formulário repete a pergunta com outra grafia, fica a primeira.
- Depois de preencher, a extensão manda os rótulos dos campos que continuaram vazios (`POST /extension/questions`). Arquivo, senha, escolhas (rádio e caixa) e rótulos com menos de 4 ou mais de 300 caracteres ficam de fora, e cada formulário manda até 30 perguntas. A API cria a pergunta sem resposta ou conta mais uma aparição, e devolve quantas ainda esperam o candidato.
- O candidato responde na tela "Banco de respostas" (`/respostas`), com as sem resposta primeiro, ou cria uma pergunta à mão.
- Ao preencher, a extensão junta o banco (`GET /extension/answers`, só as respondidas) com as respostas padrão da regra. **A regra do site vence o banco**: ela é a escolha mais específica do candidato.

**Salvar vaga de qualquer site**

- "Salvar a vaga desta página", no popup, lê a aba de site usada por último. O JSON-LD `JobPosting` dá cargo, empresa, local e descrição; sem ele, ficam o `h1` ou o título e o nome do site. A leitura é uma função injetada (`readPage`), e a interpretação é pura (`jobFromPage`), com testes.
- **O candidato confere** cargo, empresa e local antes de salvar (`POST /extension/jobs`).
- A vaga passa pelo mesmo `jobDedupeHash` das fontes. Se ela já veio de um site, ganha só mais uma fonte e não perde a descrição que tinha.
- A fonte é `manual` ("Salva por você"), criada sob demanda e **inativa**: o scheduler não busca nela, a escolha de sites dos perfis não a mostra (`GET /sources` lista só as ativas), e o admin a deixa de fora.
- A candidatura nasce em **"Ação necessária"**, no modo assistido, com a regra de envio padrão (sem regra, 409 `send_rule_required`). Ela vem com o currículo, a carta (do modelo, ou pela IA no worker se a regra pede) e as respostas. Salvar de novo devolve a candidatura que já existe. O limite diário não vale aqui: é o próprio candidato agindo numa vaga que está vendo.

## Consequências

- **Responder uma vez vale para todos os sites.** A tela do banco mostra o que falta responder e quantas vezes a pergunta apareceu.
- **O banco guarda dados pessoais** (as respostas) e entra na exclusão da conta pela cascata a partir de `User`. Os termos já cobrem as respostas padrão das regras, que são o mesmo tipo de dado; o `TERMS_VERSION` não muda.
- **Perguntas de múltipla escolha por rádio ou caixa** ainda não entram no banco nem são preenchidas. Muitos ATS usam rádio em "Sim/Não", então esse é o próximo passo natural.
- **Rótulos ruins viram perguntas ruins.** Um campo sem `<label>` útil ("Campo 1") pode ir para o banco. O candidato exclui a pergunta, mas ela volta se o formulário a repetir.
- **A vaga salva não passa pelo match** (não tem perfil) e não aparece em "Vagas", só em Candidaturas e na extensão. A fonte manual também é expirada depois de 14 dias sem ser vista, como as outras: a candidatura continua, e a vaga fica encerrada.
