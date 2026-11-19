'use client';

import { Alert, Button, PasswordInput, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation } from '@tanstack/react-query';
import { authErrorMessage, signUp } from '@/lib/session';
import { AuthCard } from './AuthCard';

/** Mesmo mínimo da API (Better Auth); a API confere de novo. */
const MIN_PASSWORD_LENGTH = 8;

type SignUpValues = { name: string; email: string; password: string };

export function SignUpForm() {
  const cadastro = useMutation({
    mutationFn: ({ name, email, password }: SignUpValues) => signUp(name, email, password),
    // o cadastro já entra na conta
    onSuccess: () => window.location.assign('/'),
  });
  const form = useForm<SignUpValues>({
    initialValues: { name: '', email: '', password: '' },
    validate: {
      name: (v) => (v.trim().length >= 2 ? null : 'Informe seu nome'),
      email: (v) => (/^\S+@\S+$/.test(v) ? null : 'Informe um e-mail válido'),
      password: (v) =>
        v.length >= MIN_PASSWORD_LENGTH
          ? null
          : `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`,
    },
  });

  return (
    <AuthCard
      title="Crie sua conta para os bots começarem a buscar vagas para você."
      footer={{ text: 'Já tem conta?', linkLabel: 'Entrar', href: '/login' }}
    >
      <form onSubmit={form.onSubmit((values) => cadastro.mutate(values))}>
        <Stack>
          {cadastro.error && (
            <Alert color="red" variant="light">
              {authErrorMessage(cadastro.error)}
            </Alert>
          )}
          <TextInput label="Nome" autoComplete="name" {...form.getInputProps('name')} />
          <TextInput
            label="E-mail"
            type="email"
            autoComplete="email"
            {...form.getInputProps('email')}
          />
          <PasswordInput
            label="Senha"
            description={`Pelo menos ${MIN_PASSWORD_LENGTH} caracteres`}
            autoComplete="new-password"
            {...form.getInputProps('password')}
          />
          <Button type="submit" loading={cadastro.isPending}>
            Criar conta
          </Button>
        </Stack>
      </form>
    </AuthCard>
  );
}
