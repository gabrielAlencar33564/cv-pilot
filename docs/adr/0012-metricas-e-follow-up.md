# ADR 0012: Métricas pelo histórico de status e follow-up sem envio

- **Status:** aceita
- **Data:** 2026-11-20

## Contexto

O RF-63 pede a taxa de resposta por currículo e por site, para o candidato saber qual currículo funciona melhor em cada site. A §3.3 de `docs/melhorias.md` pede também lembretes de follow-up: depois de alguns dias sem resposta, sugerir uma mensagem pronta.

Havia duas perguntas:

- **De onde tirar o funil.** O status atual não basta: uma candidatura que foi à entrevista e depois foi recusada está em "Recusada", mas teve resposta e entrevista. `docs/melhorias.md` (§2.6) sugeria trocar o `Application.log` em JSON por uma tabela `ApplicationEvent`.
- **Quem manda o follow-up.** O envio por e-mail (OAuth do Gmail) ainda não existe, e o recrutador muitas vezes só é alcançável pelo LinkedIn ou pelo próprio site.

## Decisão

**Métricas**

- O funil é montado pela regra pura `applicationMetrics` do `core`. Ela lê, de cada candidatura, o status atual e os destinos das entradas `status_changed` do `log`, que o painel grava desde a máquina de estados (RF-62). Cada etapa conta quem **chegou a ela em algum momento**:
  - "Enviada": tem `sentAt` ou passou por um status que só existe depois do envio;
  - "Respostas": em processo, entrevista, oferta ou recusa;
  - "Entrevistas": entrevista ou oferta;
  - "Ofertas": oferta.
- O cálculo é feito em memória, a cada `GET /applications/metrics`. As candidaturas de uma pessoa são centenas, não milhões, então não há tabela de eventos nem agregado guardado.
- A tela `/metricas` mostra o total e as tabelas por currículo, por site e por currículo × site. Taxas com menos de 5 envios aparecem apagadas, com o aviso de que ainda podem mudar muito.

**Follow-up**

- A regra `followUpState` do `core` decide a situação: "Enviada" há 7 dias sem resposta → `due`; 7 dias depois do follow-up, ainda em "Enviada" → `stale`. Qualquer outro status tira a candidatura do follow-up.
- A mensagem pronta (`followUpMessage`) é um texto fixo, sem IA, sem gênero e sem data, assinado com o nome do cadastro. Ela só diz o que é verdade: houve a candidatura e o interesse continua.
- **O CV Pilot não envia o follow-up.** O candidato copia a mensagem e manda pelo canal que tiver. Em seguida, clica em "Já mandei" (`POST /applications/:id/follow-up`), o que grava `Application.followedUpAt` e uma entrada `followed_up` no `log`. No estado `stale`, o card oferece mover a candidatura para "Sem resposta".
- O resumo diário das 8h ganhou um segundo tipo, `follow_ups`. Ele conta as candidaturas que chegaram ao prazo desde o resumo anterior, então cada uma entra numa contagem só, e não grava nada se der zero. Agora o resumo vai também para quem não tem perfil ativo, desde que tenha candidatura em "Enviada".

## Consequências

- **As métricas dependem de o candidato atualizar o status.** O CV Pilot não sabe sozinho se a empresa respondeu. A tela lembra disso, e o follow-up empurra as candidaturas paradas para "Sem resposta", o que deixa as taxas mais honestas.
- **O `log` em JSON continua sendo a fonte do histórico.** Uma entrada malformada é ignorada, sem quebrar a conta. Se as métricas precisarem de filtros por período ou de agregados no SQL, aí vale migrar para `ApplicationEvent` (§2.6 de `docs/melhorias.md`).
- **Candidaturas marcadas como enviadas antes do `sentAt` existir** contam pelo status. Elas ficam de fora só do follow-up, que precisa da data.
- **Ainda não há recorte por perfil de busca** nas métricas, que a §3.3 de `docs/melhorias.md` também cita. A candidatura já guarda o `searchProfileId`, então é só mais um agrupamento.
- Quando houver envio por e-mail, o follow-up pode sair pelo mesmo canal. Até lá, ele é sempre manual.
