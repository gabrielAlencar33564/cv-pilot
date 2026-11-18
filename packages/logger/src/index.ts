import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
import { pino, type Logger, type LoggerOptions } from 'pino';

/** Campos com dados pessoais ou segredos: saem mascarados em qualquer nível do log. */
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'encryptedTokens',
  'email',
  'phone',
  'coverLetter',
  'answers',
];

const REDACT_PATHS = [
  ...SENSITIVE_FIELDS.flatMap((field) => [field, `*.${field}`]),
  'req.headers.authorization',
  'req.headers.cookie',
];

const context = new AsyncLocalStorage<Record<string, unknown>>();

/**
 * Executa `fn` com campos extras em todas as linhas de log emitidas dentro dela,
 * inclusive em funções chamadas por ela (ex.: `queue` e `jobId` de um job).
 */
export function withLogContext<T>(fields: Record<string, unknown>, fn: () => T): T {
  return context.run({ ...context.getStore(), ...fields }, fn);
}

/** Saída legível no terminal em dev; JSON (uma linha por evento) nos demais ambientes. */
function prettyEnabled() {
  const flag = process.env.LOG_PRETTY;
  return flag ? flag === 'true' : process.env.NODE_ENV === 'development';
}

/** Opções do pino compartilhadas pela API (via Fastify) e pelos workers. */
export function loggerOptions(service: string): LoggerOptions {
  return {
    level: process.env.LOG_LEVEL ?? 'info',
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACT_PATHS, censor: '[removido]' },
    // cópia: o pino grava os campos da linha no objeto devolvido, e o contexto não pode acumulá-los
    mixin: () => ({ ...context.getStore() }),
    ...(prettyEnabled() && {
      transport: {
        // caminho absoluto: o pino resolveria o nome a partir de quem o chamou (ex.: o Fastify)
        target: createRequire(import.meta.url).resolve('pino-pretty'),
        options: { translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
      },
    }),
  };
}

export function createLogger(service: string): Logger {
  return pino(loggerOptions(service));
}

/**
 * Registra no log as falhas que derrubariam o processo e encerra com código 1,
 * para o Docker reiniciar o serviço.
 */
export function exitOnFatalErrors(log: Pick<Logger, 'fatal'>) {
  process.on('uncaughtException', (err) => {
    log.fatal({ err }, 'exceção não tratada');
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    log.fatal({ err: reason }, 'promessa rejeitada sem tratamento');
    process.exit(1);
  });
}
