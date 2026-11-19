/** globalSetup do Vitest: os testes nunca usam o Redis das filas de dev. */
export default function setup() {
  const url = process.env.TEST_REDIS_URL;
  if (!url) throw new Error('TEST_REDIS_URL não definida: configure no .env (veja .env.example)');
  if (url === process.env.REDIS_URL) {
    throw new Error('TEST_REDIS_URL é igual a REDIS_URL: os testes nunca rodam no Redis de dev');
  }
}
