const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export const formatDate = (iso: string | null) => (iso ? dateTime.format(new Date(iso)) : '—');

export const MS_PER_SECOND = 1000;
