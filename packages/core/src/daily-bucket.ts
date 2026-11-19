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

/** Hora local (0 a 23) no fuso do usuário, para agendar o que acontece "às 8h dele". */
export function localHour(at: Date, timeZone: string): number {
  // h23: meia-noite é 0, não 24
  const hour = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' });
  return Number(hour.format(at));
}
