import { db, E2E_JOB_HOST } from '../support/db';
import { launchWithExtension } from '../support/extension';
import { expect, test, uploadResume } from '../support/fixtures';
import { API_URL } from '../support/urls';

/** Vaga de um site qualquer, fora das fontes do CV Pilot, servida pelo próprio teste. */
const JOB_URL = `https://vagas-salvas.${E2E_JOB_HOST}/engenheira-de-dados`;
const JOB_PAGE = `<!doctype html>
<html lang="pt-BR"><head>
  <title>Engenheira de Dados | Dados &amp; Cia Carreiras</title>
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: 'Engenheira de Dados',
    hiringOrganization: { '@type': 'Organization', name: 'Dados & Cia' },
    jobLocation: { '@type': 'Place', address: { addressLocality: 'Recife', addressRegion: 'PE' } },
    description: '<p>Vaga de <b>Python</b> e SQL.</p>',
  })}</script>
</head><body>
<h1>Engenheira de Dados</h1>
<form onsubmit="window.enviado = true; return false;">
  <label for="nome">Nome completo</label><input id="nome" required>
  <label for="email">E-mail</label><input id="email" type="email" required>
  <label for="cnh">Possui CNH?</label><input id="cnh" required>
  <label for="python">Quanto tempo de experiência com Python?</label><textarea id="python"></textarea>
  <label for="cv">Currículo</label><input id="cv" type="file">
  <button type="submit">Enviar candidatura</button>
</form>
</body></html>`;

test('extensão: salva a vaga de qualquer site e aprende as respostas pelo banco (ADR 0011)', async ({
  page,
  account,
}) => {
  // regra de envio padrão com um currículo de verdade (cifrado no S3 de teste)
  const resumeVersionId = await uploadResume(page);
  const { resumeId } = await db.resumeVersion.findUniqueOrThrow({ where: { id: resumeVersionId } });
  await db.sendRule.create({ data: { userId: account.id, resumeId } });
  const created = await page.request.post(`${API_URL}/extension-tokens`, {
    data: { name: 'Chrome do E2E' },
  });
  const { token } = (await created.json()) as { token: string };

  const browser = await launchWithExtension();
  try {
    await browser.context.route(`${JOB_URL}**`, (route) =>
      route.fulfill({ contentType: 'text/html; charset=utf-8', body: JOB_PAGE }),
    );
    // o candidato está na página da vaga quando abre a extensão
    const vaga = await browser.context.newPage();
    await vaga.goto(JOB_URL);
    const popup = await browser.context.newPage();
    await popup.goto(`chrome-extension://${browser.extensionId}/popup.html`);
    await popup.getByLabel('Chave da extensão').fill(token);
    await popup.getByRole('button', { name: 'Conectar' }).click();

    // salvar: a vaga vem do JSON-LD da página, e o candidato confere antes
    await popup.getByRole('button', { name: 'Salvar a vaga desta página' }).click();
    await expect(popup.getByLabel('Cargo')).toHaveValue('Engenheira de Dados');
    await expect(popup.getByLabel('Empresa')).toHaveValue('Dados & Cia');
    await expect(popup.getByLabel('Local')).toHaveValue('Recife, PE');
    await popup.getByRole('button', { name: 'Salvar no CV Pilot' }).click();
    await expect(
      popup.getByText('Vaga salva: "Engenheira de Dados" está em "Ação necessária".'),
    ).toBeVisible();
    await expect(popup.getByRole('heading', { name: 'Engenheira de Dados' })).toBeVisible();

    // primeiro preenchimento: as duas perguntas que a extensão não sabe vão para o banco
    const preencher = popup.getByRole('button', { name: 'Preencher a vaga Engenheira de Dados' });
    await preencher.click();
    await expect(popup.getByText(/^Preenchi 2 campos e anexei o currículo\./)).toBeVisible();
    await expect(popup.getByText(/2 perguntas ficaram sem resposta/)).toBeVisible();
    await expect(vaga.getByLabel('Nome completo')).toHaveValue(account.name);
    await expect(vaga.getByLabel('Possui CNH?')).toHaveValue('');

    // no site: responde uma vez
    await page.goto('/respostas');
    await expect(page.getByRole('heading', { name: 'Sem resposta (2)' })).toBeVisible();
    await page.getByLabel('Resposta para "Possui CNH?"').fill('Sim, categoria B');
    await page.getByRole('button', { name: 'Salvar resposta', disabled: false }).click();
    await expect(page.getByRole('heading', { name: 'Respondidas (1)' })).toBeVisible();

    // de novo na vaga: a resposta do banco entra, e só uma pergunta continua pendente
    await vaga.reload();
    await preencher.click();
    await expect(popup.getByText(/^Preenchi 3 campos e anexei o currículo\./)).toBeVisible();
    await expect(popup.getByText(/Uma pergunta ficou sem resposta/)).toBeVisible();
    await expect(vaga.getByLabel('Possui CNH?')).toHaveValue('Sim, categoria B');
    expect(await vaga.evaluate(() => (window as { enviado?: boolean }).enviado)).toBeUndefined();

    // a vaga salva está no funil, como qualquer outra
    await page.goto('/applications');
    await expect(page.getByText('Ação necessária (1)')).toBeVisible();
    await expect(page.getByText('Dados & Cia · Salva por você')).toBeVisible();
  } finally {
    await browser.close();
  }
});
