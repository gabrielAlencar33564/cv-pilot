/**
 * Dia (AAAA-MM-DD) no fuso do usuário. O limite diário de envios vira à meia-noite dele,
 * não à do servidor (que roda em UTC no container).
 */
export function dailyBucket(at: Date, timeZone: string): string {
  // en-CA formata a data como AAAA-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}
