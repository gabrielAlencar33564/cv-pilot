'use client';

import { AccountProfileInput } from '@cv-pilot/contracts';
import { Button, Group, NumberInput, SimpleGrid, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useApiMutation } from '@/features/shared/queries';
import { numberOrNull, textOrNull } from '@/lib/form-values';
import type { Me } from '@/lib/types';

type ProfileValues = {
  name: string;
  phone: string;
  city: string;
  linkedin: string;
  github: string;
  portfolio: string;
  salaryExpectation: number | '';
  availability: string;
};

function toInput(v: ProfileValues): AccountProfileInput {
  return {
    name: v.name,
    phone: textOrNull(v.phone),
    city: textOrNull(v.city),
    links: {
      linkedin: textOrNull(v.linkedin),
      github: textOrNull(v.github),
      portfolio: textOrNull(v.portfolio),
    },
    salaryExpectation: numberOrNull(v.salaryExpectation),
    availability: textOrNull(v.availability),
  };
}

/** Perfil base do candidato (RF-02), usado depois para preencher formulários de candidatura. */
export function ProfileForm({ me }: { me: Me }) {
  const save = useApiMutation<AccountProfileInput>({
    path: '/me',
    method: 'PATCH',
    invalidate: ['me'],
    success: 'Perfil salvo',
  });
  const form = useForm<ProfileValues>({
    initialValues: {
      name: me.name ?? '',
      phone: me.phone ?? '',
      city: me.city ?? '',
      linkedin: me.links.linkedin ?? '',
      github: me.links.github ?? '',
      portfolio: me.links.portfolio ?? '',
      salaryExpectation: me.salaryExpectation ?? '',
      availability: me.availability ?? '',
    },
    // valida com o mesmo schema Zod da API; os erros de link voltam para o campo certo
    validate: (values) => {
      const result = AccountProfileInput.safeParse(toInput(values));
      if (result.success) return {};
      return Object.fromEntries(
        result.error.issues.map((i) => [String(i.path.at(-1)), 'Valor inválido']),
      );
    },
  });

  return (
    <form onSubmit={form.onSubmit((values) => save.mutate(toInput(values)))}>
      <Stack>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="Nome" autoComplete="name" {...form.getInputProps('name')} />
          <TextInput label="E-mail" value={me.email} disabled description="É o seu login" />
          <TextInput label="Telefone" autoComplete="tel" {...form.getInputProps('phone')} />
          <TextInput label="Cidade" placeholder="São Paulo - SP" {...form.getInputProps('city')} />
          <NumberInput
            label="Pretensão salarial (mensal)"
            prefix="R$ "
            thousandSeparator="."
            decimalSeparator=","
            min={0}
            allowDecimal={false}
            {...form.getInputProps('salaryExpectation')}
          />
          <TextInput
            label="Disponibilidade"
            placeholder="Imediata, 30 dias..."
            {...form.getInputProps('availability')}
          />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <TextInput
            label="LinkedIn"
            placeholder="https://linkedin.com/in/..."
            {...form.getInputProps('linkedin')}
          />
          <TextInput
            label="GitHub"
            placeholder="https://github.com/..."
            {...form.getInputProps('github')}
          />
          <TextInput
            label="Portfólio"
            placeholder="https://..."
            {...form.getInputProps('portfolio')}
          />
        </SimpleGrid>
        <Group justify="flex-end">
          <Button type="submit" loading={save.isPending}>
            Salvar perfil
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
