// "Salvar vaga de qualquer site" no popup (ADR 0011): lê a página aberta, o candidato confere
// o cargo e a empresa, e a vaga entra no CV Pilot em "Ação necessária".
import { ExtensionSaveJobInput } from '@cv-pilot/contracts';
import { ExtensionApiError, type extensionApi } from './api';
import type { BackgroundMessage, BackgroundReply } from './fill/messages';
import { el, type RunAction } from './popup-dom';
import { jobFromPage } from './save/job-from-page';

function field(id: string, label: string, value: string) {
  const input = el('input', '', { id, type: 'text' });
  input.value = value;
  return { input, nodes: [el('label', label, { for: id }), input] };
}

export function saveJobSection(
  api: ReturnType<typeof extensionApi>,
  run: RunAction,
  onSaved: (message: string) => void,
): HTMLElement {
  const section = el('section', '', { class: 'card', 'aria-label': 'Esta página' });
  const read = el('button', 'Salvar a vaga desta página', { type: 'button' });
  section.append(
    el('h2', 'Esta página'),
    el('p', 'Achou uma vaga fora do CV Pilot? Salve, e ela entra em "Ação necessária".', {
      class: 'muted',
    }),
    read,
  );

  read.addEventListener(
    'click',
    () =>
      void run(read, async () => {
        const reply = await chrome.runtime.sendMessage<BackgroundMessage, BackgroundReply>({
          type: 'read-page',
        });
        if (!reply.ok || !reply.page) {
          throw new ExtensionApiError(0, reply.ok ? 'no_page' : reply.error);
        }
        const job = jobFromPage(reply.page);
        const title = field('job-title', 'Cargo', job.title);
        const company = field('job-company', 'Empresa', job.company);
        const location = field('job-location', 'Local', job.location ?? '');
        const save = el('button', 'Salvar no CV Pilot', { type: 'submit', class: 'primary' });
        const form = el('form');
        form.append(
          el('p', job.url, { class: 'muted' }),
          ...title.nodes,
          ...company.nodes,
          ...location.nodes,
          el('div', '', { class: 'actions' }),
        );
        form.lastElementChild?.append(save);
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          void run(save, async () => {
            const input = ExtensionSaveJobInput.safeParse({
              ...job,
              title: title.input.value,
              company: company.input.value,
              location: location.input.value.trim() || null,
            });
            if (!input.success) throw new ExtensionApiError(0, 'invalid_job');
            const saved = await api.saveJob(input.data);
            onSaved(
              saved.created
                ? `Vaga salva: "${input.data.title}" está em "Ação necessária".`
                : 'Você já tinha uma candidatura para esta vaga.',
            );
          });
        });
        read.replaceWith(form);
      }),
  );
  return section;
}
