---
name: fila-worker
description: Cria ou altera filas e processors BullMQ do CV Pilot (packages/queue e apps/workers). Cobre payloads tipados, jobIds idempotentes, retentativas, UnrecoverableError, scheduler, limites diários, rate limit, WORKER_QUEUES e réplicas no compose. Use ao adicionar uma fila ou processor, mudar o pipeline scheduler → search → match → apply → notify, ou tratar falhas, atrasos e concorrência no processamento assíncrono.
---

# Filas e workers (BullMQ)

O desenho do pipeline está em `docs/visao-geral.md` §3.3. Arquivos-chave:

- [queue/index.ts](../../../packages/queue/src/index.ts): `QUEUES`, `QueuePayloads`, `defaultJobOptions` (4 tentativas, backoff exponencial de 30 s), `enqueue`.
- [workers/main.ts](../../../apps/workers/src/main.ts): mapa `processors` e seleção por `WORKER_QUEUES`.
- [scheduler/tick.ts](../../../apps/workers/src/scheduler/tick.ts): a cada 5 min, enfileira as buscas vencidas.

## Nova fila, passo a passo

1. Em `packages/queue/src/index.ts`, adicione o nome em `QUEUES` e o payload em `QueuePayloads`. **O payload leva só ids**, nunca dados pessoais nem objetos grandes; o processor recarrega o resto do banco.
2. Crie `apps/workers/src/processors/<nome>.ts` exportando `<nome>Processor`.
3. Registre no mapa `processors` de `main.ts`. O tipo `Record<QueueName, Processor>` faz o typecheck falhar se você esquecer.
4. Inclua a fila no `WORKER_QUEUES` do serviço certo em `infra/docker/compose.yaml` (`workers` para trabalho escalável, `workers-scheduler` para o que deve ter uma réplica só).
5. Produza com `enqueue('<nome>', { ... }, { jobId: '<nome>_<ids>' })`.
6. Teste o processor (skill `testes`): o caminho feliz, a entidade que sumiu e a **segunda execução do mesmo job**.

```ts
import { prisma } from '@cv-pilot/db';
import type { QueuePayloads } from '@cv-pilot/queue';
import { UnrecoverableError, type Job } from 'bullmq';
import { logger } from '../logger';

export async function exemploProcessor(job: Job<QueuePayloads['exemplo']>) {
  const item = await prisma.exemplo.findUnique({ where: { id: job.data.exemploId } });
  if (!item) return { skipped: true }; // foi removido: nada a fazer
  if (item.status !== 'pending') return { skipped: true }; // já processado (idempotência)
  if (!item.payload) throw new UnrecoverableError('payload_ausente'); // repetir não resolve

  // ... chama regras do core e grava o resultado
  logger.info({ exemploId: item.id }, 'exemplo processado');
  return { done: true };
}
```

## Regras

**Idempotência (o job pode rodar mais de uma vez)**
- Use um `jobId` determinístico (`apply_${applicationId}`). O BullMQ ignora um id que já existe, inclusive concluído, enquanto ele estiver guardado (`removeOnComplete` guarda por 24 h). Quando a repetição é intencional, inclua uma janela de tempo no id, como o `bucket` do scheduler.
- Prefira `upsert` e confira o estado atual antes de agir (o `apply` só age se `status === 'queued'`).

**Falhas**
- Erro transitório (rede, 5xx, timeout): deixe o erro subir; o BullMQ refaz com backoff.
- Erro que repetir não resolve (403, dado inválido, configuração faltando): `throw new UnrecoverableError('motivo')`.
- O job não se aplica mais (entidade removida, perfil pausado): `return { skipped: true }`.
- 429 com `Retry-After`: adie o job em vez de falhar. O processor recebe `(job, token)`; chame `await job.moveToDelayed(Date.now() + ms, token)` e depois `throw new DelayedError()`.
- Erro de fonte atualiza `Source.lastError`, como em `search.ts`.

**Concorrência e limites**
- Vários jobs rodam ao mesmo tempo (`WORKER_CONCURRENCY` × réplicas). Limite diário e contadores precisam ser **atômicos**: `INCR` + `EXPIRE` no Redis (`getRedis()`) ou transação no banco. Nunca "conta e depois grava" sem trava (item 5 de `docs/melhorias.md`).
- Rate limit por site vale para **o sistema inteiro**: Redis ou o `limiter` do Worker, nunca um `Map` em memória (item 6).
- O "dia" de um limite do usuário usa o fuso do usuário; no banco, sempre UTC.

**Arquitetura**
- Processor é fino: carrega, chama o `core`, grava e enfileira o próximo passo.
- Só os workers acessam sites de vagas e provedores de IA. A API apenas enfileira.
- O `scheduler` roda numa réplica só. O `upsertJobScheduler` é idempotente.
- O desligamento gracioso já está em `main.ts`. Não crie `setInterval` nem conexões soltas fora dele.

**Logs**
- `logger` (pino) com ids e contagens: `logger.info({ sourceId, found }, 'busca concluída')`. Nada de nome, e-mail, texto de currículo ou carta.

## Checklist

- [ ] Payload só com ids; tipo em `QueuePayloads`
- [ ] `jobId` determinístico; processor seguro para rodar duas vezes
- [ ] Erros permanentes com `UnrecoverableError`; nenhum erro engolido
- [ ] Limites e contadores atômicos; nenhum estado global em memória
- [ ] Fila registrada em `main.ts` e no `WORKER_QUEUES` do compose
- [ ] Testes, incluindo a repetição do job
