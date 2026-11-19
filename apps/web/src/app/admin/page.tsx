'use client';

import { Alert, Button, Group, Loader, Stack, Tabs, Text, Title } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import { CareerBoardsSection } from '@/features/admin/CareerBoardsSection';
import { SourcesSection, useAdminSources } from '@/features/admin/SourcesSection';
import { useMe } from '@/features/shared/queries';
import { apiUrl } from '@/lib/api';

/** Painel do admin (RF-35, RF-80, RF-81): fontes, catálogo de empresas e filas. */
export default function AdminPage() {
  const { data: me, isLoading } = useMe();
  // as rotas /admin respondem 404 para quem não é ADMIN; a tela só evita pedir à toa
  const { data: sources = [] } = useAdminSources(me?.isAdmin === true);

  if (isLoading) return <Loader />;
  if (!me?.isAdmin) {
    return <Alert color="gray">Esta área é só para administradores.</Alert>;
  }

  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Title order={2}>Admin</Title>
          <Text c="dimmed" size="sm">
            Saúde das fontes de vagas nas últimas 24 horas, catálogo de empresas e filas.
          </Text>
        </div>
        <Button
          component="a"
          href={apiUrl('/admin/queues')}
          target="_blank"
          rel="noopener"
          variant="default"
          rightSection={<IconExternalLink size={16} />}
        >
          Filas (Bull Board)
        </Button>
      </Group>

      <Tabs defaultValue="sources">
        <Tabs.List>
          <Tabs.Tab value="sources">Fontes</Tabs.Tab>
          <Tabs.Tab value="boards">Catálogo de empresas</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="sources" pt="md">
          <SourcesSection />
        </Tabs.Panel>
        <Tabs.Panel value="boards" pt="md">
          {sources.length > 0 && <CareerBoardsSection sources={sources} />}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
