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
    return reply.code(400).send({ error: 'validation_error', issues: err.issues });
  }
  if (err instanceof HttpError) {
    return reply.code(err.statusCode).send({ error: err.message });
  }
  const status = 'statusCode' in err && err.statusCode ? err.statusCode : 500;
  if (status >= 500) req.log.error(err);
  return reply.code(status).send({ error: status >= 500 ? 'internal_error' : err.message });
}
