/** Variável de ambiente obrigatória: sem padrão, para a falta de configuração aparecer na subida. */
export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não definida: configure no .env (veja .env.example)`);
  return value;
}

/** Origens do web aceitas pelo CORS e pelo login (API_CORS_ORIGIN, separadas por vírgula). */
export function corsOrigins(): string[] {
  return (process.env.API_CORS_ORIGIN ?? 'http://localhost:3000').split(',');
}
