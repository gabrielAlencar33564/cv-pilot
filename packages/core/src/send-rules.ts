/** Campos mínimos de uma regra para resolver a precedência. */
export interface ScopedRule {
  sourceId?: string | null;
  searchProfileId?: string | null;
}

/**
 * Escolhe a regra de envio mais específica.
 * Ordem: perfil+site > site > perfil > padrão (sem escopo).
 */
export function resolveSendRule<R extends ScopedRule>(
  rules: readonly R[],
  ctx: { sourceId: string; searchProfileId?: string | null },
): R | undefined {
  const profileId = ctx.searchProfileId ?? null;
  const match = (r: R, source: string | null, profile: string | null) =>
    (r.sourceId ?? null) === source && (r.searchProfileId ?? null) === profile;

  return (
    (profileId ? rules.find((r) => match(r, ctx.sourceId, profileId)) : undefined) ??
    rules.find((r) => match(r, ctx.sourceId, null)) ??
    (profileId ? rules.find((r) => match(r, null, profileId)) : undefined) ??
    rules.find((r) => match(r, null, null))
  );
}
