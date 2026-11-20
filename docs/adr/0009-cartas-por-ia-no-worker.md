# ADR 0009: Cartas de apresentação pela IA, escritas no worker

- **Status:** aceita
- **Data:** 2026-11-20

## Contexto

O RF-54 pede uma carta gerada por IA a partir da vaga, do currículo e do tom da regra do site, com edição antes do envio. A regra de envio já tinha o campo `generateCoverLetter` e o tom (`LetterTone`), mas nada os usava: a candidatura levava só o modelo do candidato preenchido com empresa, cargo e nome (`renderCoverLetter`).

Restrições que já valiam:

- IA só roda nos workers, nunca dentro de uma requisição HTTP (skill `integracao-ia`).
- A IA nunca inventa experiência, curso, cargo ou resultado (regra 4 do produto).
- Mandar ao provedor só o necessário (LGPD).
- A candidatura nasce em dois lugares: no `match` (sugerida ou na fila automática) e no "Candidatar" da API.

## Decisão

- **Fila própria, `cover-letter`.** Quando a regra pede IA, a candidatura nasce com `Application.coverLetterStatus = 'generating'`, e quem a criou enfileira `cover_letter_{candidatura}`. O processor escreve a carta e grava `generated`; recusa, saída inválida, currículo sem dados extraídos ou retentativas esgotadas gravam `failed`. Currículo ainda em leitura é erro temporário: o BullMQ tenta de novo com o backoff padrão.
- **O modelo fica de reserva.** `initialCoverLetter` (core) preenche o modelo da regra, se houver, já na criação. Se a IA falhar, ou com o provedor `noop`, a candidatura segue com ele.
- **O nome do candidato não vai para a IA.** O prompt manda assinar com `{{nome}}`, e o worker troca pelo nome com o mesmo `renderCoverLetter` dos modelos. Vão só o título, a empresa e a descrição da vaga, os dados extraídos do currículo (`ParsedResume`, que não tem nome nem contatos) e a instrução do tom.
- **Regras no system prompt.** Só fatos do currículo; nada de afirmar um requisito que o currículo não mostra; o texto da vaga e o do currículo são dados, não instruções (as descrições vêm de sites de terceiros). Saída estruturada (`CoverLetterDraft`, `zod/v4`) com `claude-opus-5-5` e esforço `medium`.
- **A edição do candidato vence a IA.** `PATCH /applications/:id` aceita `coverLetter` até o envio (`canEditCoverLetter`: sugerida, na fila ou ação necessária; depois, 409 `cover_letter_locked`) e grava `edited`. O worker só grava sobre `generating` (`updateMany` condicional), então uma edição feita enquanto a IA escreve não é sobrescrita. Marcar a candidatura como enviada antes de a IA terminar volta o status para null, e a carta que já estava fica.
- **A carta pertence à candidatura.** Com status diferente de null (IA ou edição), a pré-visualização da vaga e o "Candidatar" de uma sugerida usam a carta da candidatura, e não o modelo atual da regra.

## Consequências

- **Finalidade nova para a Anthropic.** A política (§4 de `/termos`) passou a dizer que os dados extraídos do currículo e o texto da vaga vão para escrever a carta, só com a opção ligada, e o `TERMS_VERSION` subiu para `2026-11-20.1`: todos os usuários aceitam de novo.
- **Custo de uma chamada por candidatura com a opção ligada**, não por vaga coletada. Os tokens ficam no log do worker (`carta escrita pela IA`), como nas outras tarefas.
- **O envio automático ainda não espera a carta.** Hoje todo envio termina em "Ação necessária", e o candidato vê a carta pronta no kanban. Quando os modos API e e-mail existirem, o `apply` precisa adiar o job enquanto a carta estiver `generating`.
- **Sem "escrever de novo".** A carta que falhou ou não agradou é editada à mão. Uma segunda geração pediria um id de job novo e um limite por usuário.
- **Com o `noop` (dev, E2E e CI), nada é escrito.** O E2E grava a carta direto no banco para testar a tela.
