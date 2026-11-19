'use client';

import { Alert, Button, Group, PasswordInput, SimpleGrid, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation } from '@tanstack/react-query';
import { authErrorMessage, changePassword } from '@/lib/session';

/** Mesmo mínimo da API (Better Auth). */
const MIN_PASSWORD_LENGTH = 8;

type PasswordValues = { currentPassword: string; newPassword: string };

/** Sem envio de e-mail não há "esqueci a senha": a troca é feita aqui, com a senha atual. */
export function PasswordForm() {
  const troca = useMutation({
    mutationFn: ({ currentPassword, newPassword }: PasswordValues) =>
      changePassword(currentPassword, newPassword),
    onSuccess: () => {
      form.reset();
      notifications.show({ color: 'green', message: 'Senha alterada' });
    },
  });
  const form = useForm<PasswordValues>({
    initialValues: { currentPassword: '', newPassword: '' },
    validate: {
      currentPassword: (v) => (v ? null : 'Informe a senha atual'),
      newPassword: (v) =>
        v.length >= MIN_PASSWORD_LENGTH ? null : `Pelo menos ${MIN_PASSWORD_LENGTH} caracteres`,
    },
  });

  return (
    <form onSubmit={form.onSubmit((values) => troca.mutate(values))}>
      <Stack>
        {troca.error && (
          <Alert color="red" variant="light">
            {authErrorMessage(troca.error)}
          </Alert>
        )}
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <PasswordInput
            label="Senha atual"
            autoComplete="current-password"
            {...form.getInputProps('currentPassword')}
          />
          <PasswordInput
            label="Nova senha"
            autoComplete="new-password"
            {...form.getInputProps('newPassword')}
          />
        </SimpleGrid>
        <Group justify="flex-end">
          <Button type="submit" variant="light" loading={troca.isPending}>
            Trocar senha
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
