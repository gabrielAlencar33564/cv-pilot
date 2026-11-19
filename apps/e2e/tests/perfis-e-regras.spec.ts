import { db, E2E_SOURCE } from '../support/db';
import { expect, test } from '../support/fixtures';

test.describe('perfis de busca, modelos de carta e regras de envio (RF-11, RF-12, RF-22)', () => {
  test('edita o perfil com faixa salarial e empresa excluída, e duplica', async ({
    page,
    account,
  }) => {
    await db.searchProfile.create({
      data: {
        userId: account.id,
        name: 'Front-end',
        keywords: ['react'],
        sourceIds: [E2E_SOURCE.id],
      },
    });
    await page.goto('/search-profiles');

    await page.getByRole('button', { name: 'Editar Front-end' }).click();
    const edit = page.getByRole('dialog', { name: 'Editar perfil de busca' });
    await edit.getByLabel('Salário mínimo (mensal)').fill('12000');
    await edit.getByLabel('Salário máximo (mensal)').fill('8000');
    await edit.getByRole('button', { name: 'Salvar perfil' }).click();
    await expect(
      edit.getByText('O salário máximo precisa ser maior ou igual ao mínimo'),
    ).toBeVisible();

    await edit.getByLabel('Salário máximo (mensal)').fill('15000');
    await edit.getByLabel('Empresas excluídas').fill('Empresa Ruim');
    await edit.getByLabel('Empresas excluídas').press('Enter');
    await edit.getByRole('button', { name: 'Salvar perfil' }).click();
    await expect(edit).toBeHidden();
    await expect(page.getByText(/R\$\s12\.000 a R\$\s15\.000/)).toBeVisible();
    await expect(page.getByText('Empresas excluídas: Empresa Ruim')).toBeVisible();

    await page.getByRole('button', { name: 'Duplicar Front-end' }).click();
    const copy = page.getByRole('dialog', { name: 'Duplicar perfil de busca' });
    await expect(copy.getByLabel('Nome do perfil')).toHaveValue('Front-end (cópia)');
    await copy.getByRole('button', { name: 'Salvar perfil' }).click();
    await expect(page.getByText('Front-end (cópia)')).toBeVisible();
    expect(
      await db.searchProfile.findMany({
        where: { userId: account.id },
        select: { salaryMin: true, salaryMax: true, companyBlacklist: true },
      }),
    ).toEqual([
      { salaryMin: 12000, salaryMax: 15000, companyBlacklist: ['Empresa Ruim'] },
      { salaryMin: 12000, salaryMax: 15000, companyBlacklist: ['Empresa Ruim'] },
    ]);
  });

  test('cria um modelo de carta, usa na regra com respostas padrão e remove com confirmação', async ({
    page,
    account,
  }) => {
    await db.resume.create({ data: { userId: account.id, name: 'CV Técnico' } });

    await page.goto('/cartas');
    await page.getByRole('button', { name: 'Novo modelo' }).click();
    const template = page.getByRole('dialog', { name: 'Novo modelo de carta' });
    await template.getByLabel('Nome do modelo').fill('Formal');
    await template
      .getByLabel('Texto da carta')
      .fill('Prezada equipe da {{empresa}}: sou {{nome}}.');
    await template.getByRole('button', { name: 'Salvar modelo' }).click();
    await expect(template).toBeHidden();
    await expect(page.getByText('Prezada equipe da {{empresa}}: sou {{nome}}.')).toBeVisible();

    await page.goto('/send-rules');
    await page.getByRole('button', { name: 'Nova regra' }).click();
    const rule = page.getByRole('dialog', { name: 'Nova regra de envio' });
    await rule.getByLabel('Currículo a enviar').click();
    await page.getByRole('option', { name: 'CV Técnico' }).click();
    await rule.getByLabel('Modelo de carta').click();
    await page.getByRole('option', { name: 'Formal' }).click();
    await rule.getByRole('button', { name: 'Adicionar resposta' }).click();
    await rule.getByLabel('Pergunta 1', { exact: true }).fill('Pretensão salarial');
    // exato: "Remover resposta 1" também contém "Resposta 1"
    await rule.getByLabel('Resposta 1', { exact: true }).fill('R$ 8.000');
    await rule.getByRole('button', { name: 'Salvar regra' }).click();
    await expect(rule).toBeHidden();
    await expect(page.getByRole('cell', { name: 'Formal' })).toBeVisible();
    const saved = await db.sendRule.findFirstOrThrow({ where: { userId: account.id } });
    expect(saved.defaultAnswers).toEqual({ 'Pretensão salarial': 'R$ 8.000' });

    await page.goto('/cartas');
    await page.getByRole('button', { name: 'Remover Formal' }).click();
    await page
      .getByRole('dialog', { name: 'Remover modelo' })
      .getByRole('button', { name: 'Remover', exact: true })
      .click();
    await expect(page.getByText('Nenhum modelo ainda.', { exact: false })).toBeVisible();

    // a regra que usava o modelo fica sem carta
    await page.goto('/send-rules');
    await expect(page.getByRole('cell', { name: 'Sem carta' })).toBeVisible();
  });
});
