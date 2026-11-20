// Popup da extensão: conecta com a chave gerada no site, salva a vaga da página aberta e lista
// as candidaturas em "Ação necessária", com abrir, preencher, copiar a carta e marcar como enviada.
import { EXTENSION_TOKEN_PREFIX, type ExtensionApplication } from '@cv-pilot/contracts';
import { ExtensionApiError, extensionApi } from './api';
import type { BackgroundMessage, BackgroundReply, FillReport } from './fill/messages';
import { el } from './popup-dom';
import { saveJobSection } from './popup-save-job';
import { errorMessage, fillSummary, questionsSummary } from './popup-text';

const TOKEN_KEY = 'token';
/** O mesmo teto que a API aceita por formulário. */
const MAX_QUESTIONS_PER_FORM = 30;

type Api = ReturnType<typeof extensionApi>;

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`popup.html sem o elemento #${id}`);
  return el as T;
}

const app = byId<HTMLElement>('app');
const status = byId<HTMLParagraphElement>('status');
const disconnectButton = byId<HTMLButtonElement>('disconnect');

function showStatus(text: string, isError = false) {
  status.textContent = text;
  status.className = isError ? 'error' : '';
}

const codeOf = (err: unknown) => (err instanceof ExtensionApiError ? err.code : 'unknown');

/** Roda a ação com o botão ocupado; um 401 volta para a tela de conectar. */
async function withButton(button: HTMLButtonElement, action: () => Promise<void>) {
  button.disabled = true;
  try {
    await action();
  } catch (err) {
    if (codeOf(err) === 'unauthorized') {
      await chrome.storage.local.remove(TOKEN_KEY);
      return showConnect(errorMessage('unauthorized'));
    }
    showStatus(errorMessage(codeOf(err)), true);
  } finally {
    button.disabled = false;
  }
}

const sendToBackground = (message: BackgroundMessage) =>
  chrome.runtime.sendMessage<BackgroundMessage, BackgroundReply>(message);

/**
 * O resumo do preenchimento; as perguntas que ficaram sem resposta vão para o banco de
 * respostas (ADR 0011), para o candidato responder uma vez só.
 */
async function reportFill(api: Api, report: FillReport): Promise<string> {
  const questions = report.unanswered.slice(0, MAX_QUESTIONS_PER_FORM);
  const { pending } = questions.length ? await api.reportQuestions(questions) : { pending: 0 };
  return [fillSummary(report), questionsSummary(pending)].filter(Boolean).join(' ');
}

function letterNote(application: ExtensionApplication): string {
  if (application.coverLetterStatus === 'generating') return 'A IA ainda está escrevendo a carta.';
  return application.coverLetter ? 'Com carta de apresentação.' : 'Sem carta.';
}

function applicationCard(api: Api, application: ExtensionApplication): HTMLElement {
  const { title, company } = application.job;
  const card = el('article', '', { class: 'card', 'aria-label': `${title} · ${company}` });
  const result = el('p', '', { class: 'muted', role: 'status' });
  card.append(
    el('h2', title),
    el('p', `${company} · ${application.source.displayName}`, { class: 'muted' }),
    el(
      'p',
      `${application.resume.name} v${application.resume.version} · ${letterNote(application)}`,
      {
        class: 'muted',
      },
    ),
  );

  const open = el('button', 'Abrir vaga', {
    type: 'button',
    'aria-label': `Abrir a vaga ${title}`,
  });
  open.addEventListener(
    'click',
    () =>
      void withButton(open, async () => {
        await sendToBackground({
          type: 'open',
          application: { id: application.id, url: application.url },
        });
      }),
  );

  const fill = el('button', 'Preencher', {
    type: 'button',
    class: 'primary',
    'aria-label': `Preencher a vaga ${title}`,
  });
  fill.addEventListener(
    'click',
    () =>
      void withButton(fill, async () => {
        result.textContent = 'Preenchendo...';
        const [profile, resume, savedAnswers] = await Promise.all([
          api.profile(),
          api.resume(application),
          api.answers(),
        ]);
        const reply = await sendToBackground({
          type: 'fill',
          applicationId: application.id,
          request: {
            type: 'cvpilot:fill',
            data: {
              profile,
              coverLetter: application.coverLetter,
              // as respostas da regra de envio do site vencem as do banco
              answers: { ...savedAnswers, ...application.answers },
            },
            resume,
          },
        });
        result.textContent = reply.ok && reply.report ? await reportFill(api, reply.report) : '';
        if (!reply.ok) showStatus(errorMessage(reply.error), true);
      }),
  );

  const sent = el('button', 'Marquei como enviada', {
    type: 'button',
    'aria-label': `Marcar ${title} como enviada`,
  });
  sent.addEventListener(
    'click',
    () =>
      void withButton(sent, async () => {
        await api.markSent(application.id);
        card.remove();
        showStatus(`"${title}" foi para Enviadas no CV Pilot.`);
      }),
  );

  const actions = el('div', '', { class: 'actions' });
  actions.append(open, fill);
  if (application.coverLetter) {
    const letter = application.coverLetter;
    const copy = el('button', 'Copiar carta', {
      type: 'button',
      'aria-label': `Copiar a carta de ${title}`,
    });
    copy.addEventListener(
      'click',
      () =>
        void withButton(copy, async () => {
          await navigator.clipboard.writeText(letter);
          result.textContent = 'Carta copiada.';
        }),
    );
    actions.append(copy);
  }
  actions.append(sent);
  card.append(actions, result);
  return card;
}

async function showApplications(token: string) {
  const api = extensionApi(CV_PILOT_API_URL, token);
  disconnectButton.hidden = false;
  app.replaceChildren(el('p', 'Carregando...', { class: 'muted' }));
  try {
    const applications = await api.applications();
    const onSaved = (message: string) => {
      void showApplications(token).then(() => showStatus(message));
    };
    app.replaceChildren(
      saveJobSection(api, withButton, onSaved),
      applications.length
        ? el('p', 'Abra a vaga, peça o preenchimento, confira e envie no site.', { class: 'muted' })
        : el('p', 'Nada esperando você. As candidaturas em "Ação necessária" aparecem aqui.', {
            class: 'muted',
          }),
      ...applications.map((a) => applicationCard(api, a)),
    );
  } catch (err) {
    if (codeOf(err) === 'unauthorized') {
      await chrome.storage.local.remove(TOKEN_KEY);
      return showConnect(errorMessage('unauthorized'));
    }
    app.replaceChildren();
    showStatus(errorMessage(codeOf(err)), true);
  }
}

function showConnect(error?: string) {
  disconnectButton.hidden = true;
  showStatus(error ?? '', Boolean(error));
  const form = el('form');
  const input = el('textarea', '', { id: 'token', rows: '3', required: '' });
  const submit = el('button', 'Conectar', { type: 'submit', class: 'primary' });
  form.append(
    el('p', 'Gere a chave no site do CV Pilot, em Minha conta → Extensão do navegador.'),
    el('label', 'Chave da extensão', { for: 'token' }),
    input,
    el('div', '', { class: 'actions' }),
  );
  form.lastElementChild?.append(submit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const token = input.value.trim();
    if (!token.startsWith(EXTENSION_TOKEN_PREFIX)) {
      return showStatus(errorMessage('invalid_token'), true);
    }
    void withButton(submit, async () => {
      await extensionApi(CV_PILOT_API_URL, token).profile();
      await chrome.storage.local.set({ [TOKEN_KEY]: token });
      showStatus('Extensão conectada.');
      await showApplications(token);
    });
  });
  app.replaceChildren(form);
}

disconnectButton.addEventListener('click', () => {
  void chrome.storage.local.remove(TOKEN_KEY).then(() => showConnect());
});

void chrome.storage.local.get(TOKEN_KEY).then((stored) => {
  const token = stored[TOKEN_KEY];
  return typeof token === 'string' ? showApplications(token) : showConnect();
});
