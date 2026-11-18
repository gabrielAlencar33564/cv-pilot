import { exitOnFatalErrors } from '@cv-pilot/logger';
import { buildApp } from './app';

const port = Number(process.env.API_PORT ?? 4000);
const app = await buildApp();
exitOnFatalErrors(app.log);

try {
  await app.listen({ port, host: '0.0.0.0' });
} catch (err) {
  app.log.fatal({ err }, 'a API não conseguiu subir');
  process.exit(1);
}

async function shutdown() {
  await app.close();
  process.exit(0);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void shutdown());
}
