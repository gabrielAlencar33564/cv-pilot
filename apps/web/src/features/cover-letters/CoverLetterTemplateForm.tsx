'use client';

import { COVER_LETTER_VARIABLES, CoverLetterTemplateInput } from '@cv-pilot/contracts';
import { Button, Code, Group, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useApiMutation } from '@/features/shared/queries';
import type { CoverLetterTemplateRow } from '@/lib/types';

const VARIABLE_HINTS: Record<(typeof COVER_LETTER_VARIABLES)[number], string> = {
  empresa: 'nome da empresa',
  cargo: 'título da vaga',
  nome: 'seu nome',
};

const FIELD_ERRORS: Record<string, string> = {
  name: 'Dê um nome de 2 a 80 caracteres',
  body: 'Escreva a carta (até 5.000 caracteres)',
};

/** Cria ou edita (com `template`) um modelo de carta (RF-22). */
export function CoverLetterTemplateForm({
  template,
  onDone,
}: {
  template?: CoverLetterTemplateRow;
  onDone: () => void;
}) {
  const save = useApiMutation<CoverLetterTemplateInput>({
    path: template ? `/cover-letter-templates/${template.id}` : '/cover-letter-templates',
    method: template ? 'PUT' : 'POST',
    invalidate: ['cover-letter-templates'],
    success: 'Modelo de carta salvo',
  });
  const form = useForm<CoverLetterTemplateInput>({
    initialValues: { name: template?.name ?? '', body: template?.body ?? '' },
    validate: (values) => {
      const result = CoverLetterTemplateInput.safeParse(values);
      if (result.success) return {};
      return Object.fromEntries(
        result.error.issues.map((i) => {
          const field = String(i.path[0]);
          return [field, FIELD_ERRORS[field] ?? i.message];
        }),
      );
    },
  });

  return (
    <form onSubmit={form.onSubmit((v) => save.mutate(v, { onSuccess: onDone }))}>
      <Stack>
        <TextInput label="Nome do modelo" placeholder="Padrão" {...form.getInputProps('name')} />
        <Textarea
          label="Texto da carta"
          autosize
          minRows={8}
          maxRows={20}
          placeholder="Olá, equipe da {{empresa}}! Tenho interesse na vaga de {{cargo}}..."
          {...form.getInputProps('body')}
        />
        <Text size="xs" c="dimmed">
          Variáveis:{' '}
          {COVER_LETTER_VARIABLES.map((v, i) => (
            <span key={v}>
              {i > 0 && ' · '}
              <Code>{`{{${v}}}`}</Code> {VARIABLE_HINTS[v]}
            </span>
          ))}
          . Escreva só o que é verdade sobre você: o CV Pilot não inventa experiência.
        </Text>
        <Group justify="flex-end">
          <Button type="submit" loading={save.isPending}>
            Salvar modelo
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
