# ADR 0005: Matching semântico com embeddings gerados sob demanda no match

- **Status:** aceita
- **Data:** 2026-11-19

## Contexto

O match só usava regras: palavras-chave, modelo, senioridade, contrato, salário e local (RF-40 parcial). As colunas `vector(1024)` de `Job` e `ResumeVersion` e os índices HNSW já existiam, sem uso. Os embeddings vêm do Voyage AI `voyage-4`, a recomendação da Anthropic ([ADR 0001](0001-provedor-de-ia-claude.md), skill `integracao-ia`).

Com a ingestão desacoplada, entram centenas de vagas por hora. A maioria não interessa a perfil nenhum: só uma parte passa no `isMatchCandidate` de algum perfil.

## Decisão

- **`AiProvider.embed`.** O provedor `claude` usa o Voyage por HTTP direto (`voyage.ts`, sem SDK) e exige `VOYAGE_API_KEY`. O `noop` devolve `null`, e o match segue só com as regras.
- **Embeddings gerados no match, sob demanda.** Quando o match compara uma vaga com um currículo e falta o vetor de algum dos dois, ele é gerado numa chamada só e gravado. Só são embutidas as vagas que algum perfil quer avaliar.
- **Um vetor por texto.** A ingestão apaga o vetor da vaga só quando o título ou a descrição mudam. Versões de currículo não mudam, então cada uma é embutida uma vez.
- **Currículo comparado:** a última versão lida do currículo da regra de envio do site. Sem regra, ou sem versão lida nele, vale a última versão lida de qualquer currículo do usuário.
- **Similaridade:** o cosseno do pgvector (`<=>`). A documentação do Voyage não garante vetores normalizados, e o cosseno não depende disso.
- **Nota final** em `combineWithResume`, função pura do `core`:
  - 60% da nota das regras e 40% da semelhança;
  - o cosseno vira 0-100 entre 0,3 (piso) e 0,8 (teto);
  - vaga bloqueada por regra rígida continua bloqueada;
  - os motivos ganham a semelhança e as habilidades do currículo que aparecem na vaga.
- **Falha do Voyage não derruba o match.** O match grava a nota das regras e registra o motivo no log. O vetor que faltou é gerado no próximo match daquela vaga ou daquele currículo.

## Consequências

- **O Voyage é um operador novo de dados pessoais.** Recebe o resumo, as habilidades e as experiências do currículo. Ele entrou na política (§4 de `/termos`), e o `TERMS_VERSION` subiu para `2026-11-19.2`, então todos os usuários aceitam de novo.
- **Sem calibração.** Pesos, piso e teto são um ponto de partida e são constantes nomeadas. Precisam ser ajustados com o feedback real (item 4 da §2.2 de `docs/melhorias.md`).
- **Cada match com vetor faltando faz uma chamada ao Voyage.** O primeiro match de cada vaga paga o vetor dela, e os seguintes reaproveitam. Uma vaga nova que casa com muitos perfis ao mesmo tempo pode ser embutida mais de uma vez por corrida entre matches simultâneos. É só custo, nunca um vetor errado.
- **Quem usa o `noop`, inclusive o E2E e a CI, não vê a semelhança.** Os testes de unidade cobrem a nota combinada e o fluxo com um provedor falso; o SQL dos vetores tem teste de integração no pgvector.
- **"O que falta" (RF-41) não está aqui.** Listar os requisitos da vaga que o currículo não tem pede extrair esses requisitos de cada vaga. Isso é uma chamada a LLM por vaga, ou uma lista de habilidades mantida à mão, e fica para uma decisão de custo à parte.
