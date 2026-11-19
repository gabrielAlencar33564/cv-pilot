// Campos vazios do formulário viram null: na API, "não informado" é null, não texto vazio.

export const textOrNull = (value: string) => value.trim() || null;

/** O NumberInput do Mantine fica com '' quando o campo está vazio. */
export const numberOrNull = (value: number | '') => (value === '' ? null : value);
