'use client';

import { Card, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';

const steps = [
  { href: '/search-profiles', title: '1. O que você busca', text: 'Cadastre cargos, local, modelo de trabalho e em quais sites buscar.' },
  { href: '/resumes', title: '2. Seus currículos', text: 'Envie versões diferentes: técnico, humanizado, em inglês...' },
  { href: '/send-rules', title: '3. Envio por site', text: 'Escolha qual currículo e qual tom de carta usar em cada site.' },
  { href: '/jobs', title: '4. Vagas encontradas', text: 'Os bots buscam e ordenam as vagas pela compatibilidade.' },
];

export default function HomePage() {
  return (
    <Stack>
      <Title order={2}>Bem-vindo ao CV Pilot</Title>
      <Text c="dimmed">Configure uma vez e deixe os bots trabalharem por você.</Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        {steps.map((s) => (
          <Card key={s.href} component={Link} href={s.href} withBorder padding="lg">
            <Text fw={600}>{s.title}</Text>
            <Text size="sm" c="dimmed" mt={4}>
              {s.text}
            </Text>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
