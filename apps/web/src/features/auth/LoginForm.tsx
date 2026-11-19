'use client';

import { Alert, Button, PasswordInput, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { safeNextPath } from '@/lib/routes';
import { authErrorMessage, signIn } from '@/lib/session';
import { AuthCard } from './AuthCard';

type LoginValues = { email: string; password: string };

export function LoginForm() {
  const next = safeNextPath(useSearchParams().get('next'));
  const login = useMutation({
    mutationFn: ({ email, password }: LoginValues) => signIn(email, password),
    // recarrega a página inteira: nada do usuário anterior fica no cache das queries
    onSuccess: () => window.location.assign(next),
  });
  const form = useForm<LoginValues>({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+$/.test(v) ? null : 'Informe um e-mail válido'),
      password: (v) => (v ? null : 'Informe a senha'),
    },
  });

  return (
    <AuthCard
      title="Entre para acompanhar suas vagas e candidaturas."
      footer={{ text: 'Ainda não tem conta?', linkLabel: 'Cadastre-se', href: '/cadastro' }}
    >
      <form onSubmit={form.onSubmit((values) => login.mutate(values))}>
        <Stack>
          {login.error && (
            <Alert color="red" variant="light">
              {authErrorMessage(login.error)}
            </Alert>
          )}
          <TextInput
            label="E-mail"
            type="email"
            autoComplete="email"
            {...form.getInputProps('email')}
          />
          <PasswordInput
            label="Senha"
            autoComplete="current-password"
            {...form.getInputProps('password')}
          />
          <Button type="submit" loading={login.isPending}>
            Entrar
          </Button>
        </Stack>
      </form>
    </AuthCard>
  );
}
