// Script injetado na página da vaga quando o candidato pede o preenchimento. Só escreve nos
// campos vazios e nunca envia o formulário: quem revisa e clica em enviar é o candidato.
import {
  isResumeInput,
  matchField,
  pickOption,
  questionOf,
  type FieldInfo,
  type FillData,
} from './fill/match-field';
import type { FillReport, FillRequest, ResumeFile } from './fill/messages';

type FormField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** Contorno nos campos preenchidos, para o candidato ver o que conferir. */
const FILLED_OUTLINE = '2px solid #7048e8';

declare global {
  interface Window {
    cvPilotFillReady?: boolean;
  }
}

const textOf = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

function labelOf(el: FormField): string {
  const byLabels = [...(el.labels ?? [])].map(textOf).join(' ');
  if (byLabels) return byLabels;
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    return labelledBy
      .split(/\s+/)
      .map((id) => textOf(document.getElementById(id)))
      .join(' ');
  }
  return el.getAttribute('aria-label') ?? '';
}

function infoOf(el: FormField): FieldInfo {
  return {
    tag:
      el instanceof HTMLTextAreaElement
        ? 'textarea'
        : el instanceof HTMLSelectElement
          ? 'select'
          : 'input',
    type: el instanceof HTMLInputElement ? el.type.toLowerCase() : '',
    label: labelOf(el),
    name: el.name,
    id: el.id,
    placeholder: el.getAttribute('placeholder') ?? '',
    autocomplete: el.getAttribute('autocomplete') ?? '',
  };
}

/**
 * Escreve pelo setter nativo e avisa a página: formulários em React e afins só enxergam o
 * valor novo com os eventos `input` e `change`.
 */
function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Vazio para o candidato: um select ainda na primeira opção ("Selecione") conta como vazio. */
function isEmpty(el: FormField) {
  if (el instanceof HTMLSelectElement) return el.selectedIndex <= 0 || !el.value;
  if (el instanceof HTMLInputElement && el.type === 'file') return !el.files?.length;
  return !el.value.trim();
}

function fillField(el: FormField, data: FillData): FillReport['filled'][number] | null {
  const readOnly = !(el instanceof HTMLSelectElement) && el.readOnly;
  if (el.disabled || readOnly || !isEmpty(el)) return null;
  const info = infoOf(el);
  const match = matchField(info, data);
  if (!match) return null;

  if (el instanceof HTMLSelectElement) {
    const index = pickOption(
      [...el.options].map((o) => o.text),
      match.value,
    );
    if (index < 0) return null;
    el.selectedIndex = index;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    setValue(el, match.value);
  }
  el.style.outline = FILLED_OUTLINE;
  return { label: info.label || info.placeholder || info.name, source: match.source };
}

function attachResume(resume: ResumeFile): boolean {
  const inputs = [...document.querySelectorAll<HTMLInputElement>('input[type="file"]')].filter(
    (el) => !el.disabled,
  );
  const target = inputs.find((el) => isResumeInput(infoOf(el), inputs.length));
  if (!target) return false;

  const bytes = Uint8Array.from(atob(resume.base64), (c) => c.charCodeAt(0));
  const files = new DataTransfer();
  files.items.add(new File([bytes], resume.fileName, { type: resume.mimeType }));
  target.files = files.files;
  target.dispatchEvent(new Event('input', { bubbles: true }));
  target.dispatchEvent(new Event('change', { bubbles: true }));
  target.style.outline = FILLED_OUTLINE;
  return true;
}

function fill(request: FillRequest): FillReport {
  const fields = [...document.querySelectorAll<FormField>('input, textarea, select')];
  const filled = fields.flatMap((el) => fillField(el, request.data) ?? []);
  const resumeAttached = request.resume ? attachResume(request.resume) : false;
  const empty = fields.filter((el) => !el.disabled && isEmpty(el));
  const requiredEmpty = empty.filter((el) => el.required).length;
  // o que continuou vazio vira pergunta para o banco de respostas
  const unanswered = [...new Set(empty.flatMap((el) => questionOf(infoOf(el)) ?? []))];
  return { filled, resumeAttached, requiredEmpty, unanswered };
}

// a extensão injeta o script a cada pedido: o ouvinte entra uma vez só
if (!window.cvPilotFillReady) {
  window.cvPilotFillReady = true;
  chrome.runtime.onMessage.addListener((message: FillRequest, _sender, sendResponse) => {
    if (message.type !== 'cvpilot:fill') return false;
    sendResponse(fill(message));
    return false;
  });
}
