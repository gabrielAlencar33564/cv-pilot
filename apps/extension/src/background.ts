// Service worker: abre a vaga numa aba, preenche a aba da vaga e lê a página aberta quando o
// popup pede. Fica aqui, e não no popup, porque o popup fecha assim que a aba nova ganha o foco.
import type { BackgroundMessage, BackgroundReply, FillReport, FillRequest } from './fill/messages';
import { readPage } from './save/read-page';

/** candidatura → aba onde a vaga dela foi aberta, enquanto o navegador estiver aberto */
const TABS_KEY = 'applicationTabs';

async function tabsByApplication(): Promise<Record<string, number>> {
  const stored = await chrome.storage.session.get(TABS_KEY);
  return (stored[TABS_KEY] as Record<string, number> | undefined) ?? {};
}

async function openApplication(application: { id: string; url: string }) {
  const tab = await chrome.tabs.create({ url: application.url, active: true });
  if (tab.id === undefined) return;
  const tabs = await tabsByApplication();
  await chrome.storage.session.set({ [TABS_KEY]: { ...tabs, [application.id]: tab.id } });
}

/**
 * A página em que o candidato estava: a aba de site (https) usada por último. O popup não é
 * uma aba, e as páginas do navegador ficam de fora.
 */
async function currentPageTab(): Promise<number | undefined> {
  const tabs = await chrome.tabs.query({ url: 'https://*/*' });
  const [latest] = tabs.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0));
  return latest?.id;
}

/** A aba aberta para a candidatura, se ainda existe; senão, a página em que o candidato está. */
async function targetTab(applicationId: string): Promise<number | undefined> {
  const opened = (await tabsByApplication())[applicationId];
  if (opened !== undefined) {
    const tab = await chrome.tabs.get(opened).catch(() => undefined);
    if (tab?.id !== undefined) return tab.id;
  }
  return currentPageTab();
}

async function fillApplication(
  message: Extract<BackgroundMessage, { type: 'fill' }>,
): Promise<BackgroundReply> {
  const tabId = await targetTab(message.applicationId);
  if (tabId === undefined) return { ok: false, error: 'no_tab' };
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['fill.js'] });
  } catch {
    // páginas do próprio navegador e da loja de extensões não aceitam scripts
    return { ok: false, error: 'page_not_allowed' };
  }
  const report = await chrome.tabs.sendMessage<FillRequest, FillReport>(tabId, message.request);
  return { ok: true, report };
}

/** "Salvar vaga de qualquer site": o que a página aberta diz da vaga (ADR 0011). */
async function readCurrentPage(): Promise<BackgroundReply> {
  const tabId = await currentPageTab();
  if (tabId === undefined) return { ok: false, error: 'no_page' };
  try {
    const [result] = await chrome.scripting.executeScript({ target: { tabId }, func: readPage });
    return result?.result ? { ok: true, page: result.result } : { ok: false, error: 'no_page' };
  } catch {
    return { ok: false, error: 'page_not_allowed' };
  }
}

async function handle(message: BackgroundMessage): Promise<BackgroundReply> {
  switch (message.type) {
    case 'open':
      await openApplication(message.application);
      return { ok: true };
    case 'fill':
      return fillApplication(message);
    case 'read-page':
      return readCurrentPage();
  }
}

chrome.runtime.onMessage.addListener((message: BackgroundMessage, _sender, sendResponse) => {
  handle(message).then(sendResponse, (err: unknown) =>
    sendResponse({ ok: false, error: err instanceof Error ? err.message : 'unknown' }),
  );
  // resposta assíncrona: o canal fica aberto até o sendResponse
  return true;
});
