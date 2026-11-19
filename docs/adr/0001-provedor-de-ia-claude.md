# ADR 0001: Claude como provedor de IA da extração de currículos

- **Status:** aceita
- **Data:** 2026-11-18

## Contexto

O RF-21 pede a extração automática dos dados do currículo: habilidades, experiências, formação e idiomas. Essa era a questão em aberto nº 2 do PRD. Os currículos chegam em PDF ou DOCX, muitas vezes com layout em colunas ou como imagem escaneada. A saída precisa caber num formato fixo, porque alimenta o matching e, depois, o preenchimento de formulários.

## Decisão

- A extração usa o Claude `claude-opus-5-5` pelo SDK oficial `@anthropic-ai/sdk`, implementando a interface `AiProvider` de `packages/ai`.
- O PDF vai inteiro como bloco `document`, e o próprio modelo lê o layout. O DOCX é convertido em texto antes, com o `mammoth`, nos workers.
- **Saída estruturada.** `beta.messages.parse` + `betaZodOutputFormat` com o schema `ParsedResume` de `packages/contracts`. O mesmo schema valida o resultado antes de gravar.
  - Como o helper do SDK só aceita `zod/v4`, esse schema usa o subcaminho `zod/v4` do Zod 3.25.
- **Fallback de recusa no servidor** (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`). Se o modelo recusar, o servidor tenta um modelo de reserva na mesma chamada.
- **Falhas definitivas não repetem.** `refusal`, `max_tokens`, saída fora do schema e erro 400 viram `ResumeParseError`: a versão fica `failed` com o código, e o job não repete. Erro 429, 5xx e falhas de rede repetem pelo BullMQ.
- **`AI_PROVIDER` é obrigatório** (`claude` ou `noop`), sem padrão: uma variável esquecida não pode desligar a IA em silêncio. O `noop` serve para dev e testes sem chave.
- **Embeddings ficam para a Etapa 3.** A Anthropic não tem modelo de embeddings; a recomendação é o Voyage `voyage-4` (1024 dimensões, já refletidas nas colunas `vector(1024)`).

## Consequências

- Uma extração por versão de currículo, nunca repetida. Os tokens gastos vão para o log do worker (`inputTokens` e `outputTokens`).
- Enviar o currículo ao provedor é compartilhamento de dados pessoais e pode ser transferência internacional. Antes de usuários reais, isso precisa estar na política de privacidade e no consentimento (RF-03, Etapa 2). Até lá, só CVs sintéticos passam pela chamada real.
- O prompt manda não inventar dados e não extrair CPF, RG, endereço, data de nascimento nem contato. O PDF vai inteiro, então esses dados chegam ao provedor mesmo assim; só não são gravados.
- Trocar por um modelo menor (Sonnet 5.5, Haiku 5.5) é decisão de custo, depois de medir a qualidade num conjunto de avaliação.
