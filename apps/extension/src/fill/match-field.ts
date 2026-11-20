import { MIN_QUESTION_CHARS, type ExtensionProfile } from '@cv-pilot/contracts';

/** O que a extensão sabe de um campo do formulário, lido da página. */
export interface FieldInfo {
  tag: 'input' | 'textarea' | 'select';
  type: string;
  /** texto do `<label>`, do `aria-label` ou do `aria-labelledby` */
  label: string;
  name: string;
  id: string;
  placeholder: string;
  autocomplete: string;
}

/** O que dá para pôr no formulário: o perfil base, a carta e as respostas da regra de envio. */
export interface FillData {
  profile: ExtensionProfile;
  coverLetter: string | null;
  /** pergunta → resposta (respostas padrão da regra de envio) */
  answers: Record<string, string>;
}

/** De onde veio o valor, para o resumo que o candidato confere. */
export type FieldSource =
  | 'answer'
  | 'coverLetter'
  | 'name'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'city'
  | 'linkedin'
  | 'github'
  | 'portfolio'
  | 'salary'
  | 'availability';

export interface FieldMatch {
  value: string;
  source: FieldSource;
}

/** Campos que a extensão nunca toca: senha, botões, escolhas e o arquivo (anexado à parte). */
const SKIPPED_TYPES = new Set([
  'hidden',
  'password',
  'submit',
  'button',
  'reset',
  'image',
  'checkbox',
  'radio',
  'file',
  'search',
]);

/** Rótulo mais longo que isso é texto de ajuda da página, não uma pergunta. */
const MAX_QUESTION_CHARS = 300;

/** Minúsculas, sem acento, com os separadores de nome de campo virando espaço. */
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_\-.[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const AUTOCOMPLETE: Record<string, FieldSource> = {
  name: 'name',
  'given-name': 'firstName',
  'family-name': 'lastName',
  email: 'email',
  tel: 'phone',
  'tel-national': 'phone',
  'address-level2': 'city',
};

/**
 * Palavras que identificam cada campo do perfil, na ordem em que são testadas. O nome vem por
 * último e recusa "nome da empresa" e afins, que não são o nome do candidato.
 */
const PROFILE_RULES: readonly [RegExp, FieldSource][] = [
  [/linkedin/, 'linkedin'],
  [/github/, 'github'],
  [/(portfolio|portifolio|site pessoal|website|personal site)/, 'portfolio'],
  [/(e ?mail)/, 'email'],
  [/(telefone|celular|whatsapp|phone|mobile|fone)/, 'phone'],
  [/(pretensao|salari|salary|remuneracao)/, 'salary'],
  [/(disponibilidade|availability|data de inicio|start date)/, 'availability'],
  [/(cidade|city|municipio)/, 'city'],
  [/(sobrenome|last name|surname|family name)/, 'lastName'],
  [/(primeiro nome|first name|given name)/, 'firstName'],
];
const NAME = /\b(nome|name)\b/;
const NOT_CANDIDATE_NAME =
  /(empresa|company|usuario|user ?name|mae|pai|social|indicacao|referencia)/;
const COVER_LETTER = /(carta|cover letter|apresentacao|motivacao|por que voce|why do you|mensagem)/;

function profileValue(source: FieldSource, data: FillData): string | null {
  const { profile } = data;
  const [first = '', ...rest] = (profile.name ?? '').trim().split(/\s+/);
  const values: Partial<Record<FieldSource, string | null | undefined>> = {
    name: profile.name,
    firstName: first,
    lastName: rest.join(' '),
    email: profile.email,
    phone: profile.phone,
    city: profile.city,
    linkedin: profile.links.linkedin,
    github: profile.links.github,
    portfolio: profile.links.portfolio,
    salary: profile.salaryExpectation?.toString(),
    availability: profile.availability,
    coverLetter: data.coverLetter,
  };
  return values[source] || null;
}

/** A resposta padrão cuja pergunta aparece no rótulo do campo (ou o contrário). */
function answerFor(text: string, answers: Record<string, string>): string | null {
  for (const [question, answer] of Object.entries(answers)) {
    const q = normalize(question);
    if (q.length < MIN_QUESTION_CHARS || !answer) continue;
    if (text.includes(q) || (text.length >= MIN_QUESTION_CHARS && q.includes(text))) return answer;
  }
  return null;
}

/**
 * O valor para um campo do formulário, ou null para deixá-lo como está. As respostas padrão
 * que o candidato escreveu vêm antes de tudo; a carta só vai em área de texto.
 */
export function matchField(field: FieldInfo, data: FillData): FieldMatch | null {
  if (field.tag === 'input' && SKIPPED_TYPES.has(field.type)) return null;

  const label = normalize(field.label || field.placeholder);
  const text = normalize([field.label, field.placeholder, field.name, field.id].join(' '));

  const answer = answerFor(label, data.answers);
  if (answer) return { value: answer, source: 'answer' };

  const candidates: FieldSource[] = [];
  const byAutocomplete = AUTOCOMPLETE[field.autocomplete.trim().toLowerCase()];
  if (byAutocomplete) candidates.push(byAutocomplete);
  if (field.type === 'email') candidates.push('email');
  if (field.type === 'tel') candidates.push('phone');
  if (field.tag === 'textarea' && COVER_LETTER.test(text)) candidates.push('coverLetter');
  for (const [pattern, source] of PROFILE_RULES) if (pattern.test(text)) candidates.push(source);
  if (NAME.test(text) && !NOT_CANDIDATE_NAME.test(text)) candidates.push('name');

  for (const source of candidates) {
    const value = profileValue(source, data);
    if (value) return { value, source };
  }
  return null;
}

/**
 * A pergunta que um campo que ficou vazio faz, para o banco de respostas (ADR 0011): o rótulo,
 * se ele for legível. Arquivo, senha, escolhas e botões não são perguntas que o banco responde.
 */
export function questionOf(field: FieldInfo): string | null {
  if (field.tag === 'input' && SKIPPED_TYPES.has(field.type)) return null;
  const question = (field.label || field.placeholder).replace(/\s+/g, ' ').trim();
  if (question.length < MIN_QUESTION_CHARS || question.length > MAX_QUESTION_CHARS) return null;
  return question;
}

/** O campo de arquivo que recebe o currículo: o que fala em currículo, ou o único da página. */
export function isResumeInput(field: Pick<FieldInfo, 'label' | 'name' | 'id'>, fileInputs: number) {
  const text = normalize([field.label, field.name, field.id].join(' '));
  return /(curriculo|\bcv\b|resume|anexo)/.test(text) || fileInputs === 1;
}

/** A opção de uma lista que corresponde ao valor (igual ou contendo), ou -1. */
export function pickOption(options: readonly string[], value: string): number {
  const target = normalize(value);
  const normalized = options.map(normalize);
  const exact = normalized.indexOf(target);
  if (exact >= 0) return exact;
  return normalized.findIndex((option) => option.length > 0 && option.includes(target));
}
