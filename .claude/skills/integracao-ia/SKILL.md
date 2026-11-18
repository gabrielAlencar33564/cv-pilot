---
name: integracao-ia
description: Implementa os recursos de IA do CV Pilot (packages/ai e os processors resume-parse e match). Cobre extração estruturada de currículos PDF/DOCX, cartas de apresentação, ajuste de CV por vaga, embeddings com pgvector e matching semântico, usando o SDK oficial da Anthropic (Claude) e o Voyage AI para embeddings. Use ao implementar ou mudar o AiProvider, prompts, chamadas a LLM, embeddings, controle de custo de IA ou qualquer texto gerado para o candidato.
---

# Integração com IA

## Arquitetura

- Toda chamada passa pela interface `AiProvider` de [packages/ai/src/index.ts](../../../packages/ai/src/index.ts). Processors e API **nunca** importam o SDK diretamente.
- O provedor é escolhido por `AI_PROVIDER`. O `NoopAiProvider` continua existindo para dev e testes sem chave.
- IA roda **só nos workers** (extração no `resume-parse`, carta no fluxo de candidatura), nunca dentro de uma requisição HTTP.
- Ao implementar o provedor real, troque `AI_API_KEY` por `ANTHROPIC_API_KEY` (que o SDK lê sozinho) e `VOYAGE_API_KEY` no `.env.example`, sem deixar a variável antiga para trás.

## Modelos

| Uso | Modelo | Observação |
|---|---|---|
| Extração de CV, cartas, ajuste de CV | `claude-opus-5-5` (SDK `@anthropic-ai/sdk`) | Trocar por um modelo menor só depois de medir a qualidade num conjunto de avaliação; é uma decisão de custo do responsável pelo projeto |
| Embeddings | Voyage AI `voyage-4` ou `voyage-4-lite` | A Anthropic não tem modelo de embeddings. Ambos são multilíngues, 1024 dimensões por padrão, vetores normalizados (cosseno = produto escalar) |

- **A dimensão do embedding define a coluna `vector(N)`** (skill `banco-prisma`). Trocar de modelo exige migration e reprocessamento.
- Use `input_type: 'document'` para vagas e currículos e `'query'` para consultas.
- Para a assinatura exata do SDK, consulte a documentação oficial; **não chute nomes de método**:
  - Claude: <https://platform.claude.com/docs/en/build-with-claude/structured-outputs> e `pdf-support`;
  - Voyage: <https://platform.claude.com/docs/en/build-with-claude/embeddings>.

## Extração de currículo (RF-21)

- **PDF:** envie o arquivo direto como bloco `document` em base64, antes do texto do pedido (limite de 32 MB / 600 páginas).
- **DOCX:** converta para texto antes (ex.: `mammoth`; adicione a dependência só quando implementar).
- Use **saída estruturada** (`output_config.format` ou o helper `messages.parse` com schema Zod). O `ParsedResume` vira schema Zod; como o usuário revisa esses dados na tela, ele vai para `packages/contracts`.
- Extraia **uma vez por `ResumeVersion`** e grave em `parsed`. Nunca reprocesse a mesma versão.
- Trate `stop_reason`: `refusal` ou `max_tokens` = falha da extração (registre e marque para revisão manual; não grave dado parcial).
- Erros do SDK pelas classes tipadas: `RateLimitError` e erros 5xx sobem para o BullMQ refazer; `BadRequestError` vira `UnrecoverableError`.

## Cartas e ajuste de CV (RF-54)

- Entrada: vaga (título, empresa, descrição), `ParsedResume`, tom da regra (`LetterTone`) e nome do candidato. Saída em pt-BR, salva em `Application.coverLetter`. O candidato pode editar antes de enviar.
- **O system prompt é obrigado a dizer:** use só fatos do currículo; não invente experiência, número, curso ou cargo; se falta um requisito da vaga, não afirme que o candidato o tem.
- Monte os prompts em funções puras em `packages/ai/src/prompts/` (testáveis). Parte estável primeiro e dados variáveis depois, para aproveitar o **prompt caching**.
- No ajuste de CV, mostre ao usuário o que mudou e grave como nova `ResumeVersion` derivada. Nunca sobrescreva o original.

## Embeddings e matching (RF-40)

- Texto da vaga: título + descrição. Texto do CV: resumo + habilidades + experiências.
- Guarde o hash do texto e **não gere de novo** se o texto não mudou.
- Gravação e consulta via SQL parametrizado (skill `banco-prisma`). A nota final combina regras e similaridade numa **função pura do `core`**, com teste.

## LGPD e custo

- Mande só o necessário: nada de CPF, RG, endereço completo ou foto. Nunca logue prompt nem resposta com dados pessoais.
- O provedor de IA precisa constar na política de privacidade e no consentimento (skill `lgpd-seguranca`).
- Registre `usage` (tokens) por usuário e por tarefa. Isso prepara os limites por plano.
- Reprocessamento em massa (ex.: trocar o modelo de embeddings) vai pela Batches API ou numa fila com concorrência baixa.

## Testes

- Teste os construtores de prompt (puros), a validação da saída e a combinação de notas.
- Nos processors, use o `NoopAiProvider` ou um provedor falso. **Nenhum teste chama a API real.**

## Checklist

- [ ] Chamada só via `AiProvider`, só nos workers
- [ ] Saída estruturada validada; `stop_reason` tratado
- [ ] Prompt com a regra de não inventar fatos; dados pessoais minimizados
- [ ] Dimensão do embedding = coluna `vector(N)`; nada é recalculado sem mudança
- [ ] `.env.example` atualizado, sem variável morta; uso de tokens registrado
