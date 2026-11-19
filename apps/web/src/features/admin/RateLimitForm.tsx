'use client';

import { Button, Group, NumberInput, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { UpdateSourceInput, type AdminSourceRow } from '@cv-pilot/contracts';
import { useApiMutation } from '@/features/shared/queries';
import { MS_PER_SECOND } from './format';

/** Limite de requisições da fonte (RF-35): N requisições a cada tantos segundos. */
export function RateLimitForm({ source, onDone }: { source: AdminSourceRow; onDone: () => void }) {
  const save = useApiMutation<UpdateSourceInput>({
    path: `/admin/sources/${source.id}`,
    method: 'PATCH',
    invalidate: ['admin-sources'],
    success: 'Limite salvo',
  });
  const form = useForm({
    initialValues: {
      rateLimitReqs: source.rateLimitReqs,
      seconds: source.rateLimitMs / MS_PER_SECOND,
    },
    validate: (v) => {
      const result = UpdateSourceInput.safeParse({
        rateLimitReqs: v.rateLimitReqs,
        rateLimitMs: v.seconds * MS_PER_SECOND,
      });
      if (result.success) return {};
      return Object.fromEntries(
        result.error.issues.map((i) => [
          i.path[0] === 'rateLimitMs' ? 'seconds' : String(i.path[0]),
          'Valor fora da faixa permitida',
        ]),
      );
    },
  });

  return (
    <form
      onSubmit={form.onSubmit((v) =>
        save.mutate(
          { rateLimitReqs: v.rateLimitReqs, rateLimitMs: v.seconds * MS_PER_SECOND },
          { onSuccess: onDone },
        ),
      )}
    >
      <Stack>
        <Text size="sm" c="dimmed">
          O bot espera entre uma requisição e outra ao mesmo site, somando todas as réplicas.
        </Text>
        <Group grow>
          <NumberInput
            label="Requisições"
            min={1}
            allowDecimal={false}
            {...form.getInputProps('rateLimitReqs')}
          />
          <NumberInput
            label="A cada (segundos)"
            min={1}
            allowDecimal={false}
            {...form.getInputProps('seconds')}
          />
        </Group>
        <Group justify="flex-end">
          <Button type="submit" loading={save.isPending}>
            Salvar limite
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
