'use client';

import { Badge, Button, Card, Group, Modal, Stack, Switch, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import { SearchProfileForm } from '@/features/search-profiles/SearchProfileForm';
import { useApiMutation, useSearchProfiles, useSources } from '@/features/shared/queries';
import { workModelLabels } from '@/lib/labels';

export default function SearchProfilesPage() {
  const [opened, { open, close }] = useDisclosure();
  const { data: profiles = [], isLoading } = useSearchProfiles();
  const { data: sources = [] } = useSources();
  const toggle = useApiMutation<{ id: string; active: boolean }>({
    path: (b) => `/search-profiles/${b.id}/active`,
    method: 'PATCH',
    invalidate: ['search-profiles'],
  });
  const sourceName = (id: string) => sources.find((s) => s.id === id)?.displayName ?? id;

  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Title order={2}>O que estou buscando</Title>
          <Text c="dimmed" size="sm">
            Cada perfil gera buscas automáticas nos sites selecionados.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          Novo perfil
        </Button>
      </Group>

      {!isLoading && profiles.length === 0 && <Text c="dimmed">Nenhum perfil de busca ainda.</Text>}

      {profiles.map((p) => (
        <Card key={p.id} withBorder>
          <Group justify="space-between" align="flex-start">
            <Stack gap={6}>
              <Text fw={600}>{p.name}</Text>
              <Group gap={6}>
                {p.keywords.map((k) => (
                  <Badge key={k} variant="light">
                    {k}
                  </Badge>
                ))}
                {p.workModels.map((w) => (
                  <Badge key={w} color="gray" variant="outline">
                    {workModelLabels[w] ?? w}
                  </Badge>
                ))}
              </Group>
              <Text size="sm" c="dimmed">
                Sites: {p.sourceIds.map(sourceName).join(', ')} · nota mínima {p.minScoreAutoApply}%
              </Text>
            </Stack>
            <Switch
              label={p.active ? 'Ativo' : 'Pausado'}
              checked={p.active}
              onChange={(e) => toggle.mutate({ id: p.id, active: e.currentTarget.checked })}
            />
          </Group>
        </Card>
      ))}

      <Modal opened={opened} onClose={close} title="Novo perfil de busca" size="lg">
        <SearchProfileForm onDone={close} />
      </Modal>
    </Stack>
  );
}
