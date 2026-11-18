import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorHandler(err: FastifyError | Error, req: FastifyRequest, reply: FastifyReply) {
  if (err instanceof ZodError) {
    // só os caminhos dos campos: os valores enviados podem conter dados pessoais
    req.log.info({ fields: err.issues.map((i) => i.path.join('.')) }, 'entrada inválida');
    return reply.code(400).send({ error: 'validation_error', issues: err.issues });
  }
  if (err instanceof HttpError) {
    req.log.info({ statusCode: err.statusCode, code: err.message }, 'requisição recusada');
    return reply.code(err.statusCode).send({ error: err.message });
  }
  const status = 'statusCode' in err && err.statusCode ? err.statusCode : 500;
  if (status >= 500) {
    req.log.error({ err }, 'erro inesperado na requisição');
  } else {
    req.log.info(
      { statusCode: status, code: 'code' in err ? err.code : undefined },
      'requisição recusada',
    );
  }
  return reply.code(status).send({ error: status >= 500 ? 'internal_error' : err.message });
}
