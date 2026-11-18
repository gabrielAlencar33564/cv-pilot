import { buildApp } from './app';

const port = Number(process.env.API_PORT ?? 4000);
const app = await buildApp();

try {
  await app.listen({ port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

async function shutdown() {
  await app.close();
  process.exit(0);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void shutdown());
}
