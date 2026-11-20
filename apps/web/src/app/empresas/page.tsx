'use client';

import { Stack, Text, Title } from '@mantine/core';
import { CompanySuggestions } from '@/features/companies/CompanySuggestions';

export default function CompaniesPage() {
  return (
    <Stack>
      <div>
        <Title order={2}>Empresas</Title>
        <Text c="dimmed" size="sm">
          Quer acompanhar uma empresa que ainda não aparece nas vagas? Cole a página de carreiras
          dela. Se ela usa um site de vagas que o CV Pilot lê, entra no catálogo e as vagas passam a
          chegar para todos.
        </Text>
      </div>
      <CompanySuggestions />
    </Stack>
  );
}
