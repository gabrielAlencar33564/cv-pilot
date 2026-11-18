'use client';

import { Badge, Card, ScrollArea, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { modeLabels, statusLabels } from '@/lib/labels';
import type { ApplicationRow } from '@/lib/types';

const columns = ['suggested', 'needs_action', 'queued', 'sent', 'interview', 'offer'] as const;

export default function ApplicationsPage() {
  const { data: apps = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: () => api<ApplicationRow[]>('/applications'),
  });

  return (
    <Stack>
      <Title order={2}>Candidaturas</Title>
      <ScrollArea>
        <SimpleGrid cols={columns.length} miw={columns.length * 240}>
          {columns.map((status) => {
            const items = apps.filter((a) => a.status === status);
            return (
              <Stack key={status} gap="xs">
                <Text fw={600} size="sm">
                  {statusLabels[status]} ({items.length})
                </Text>
                {items.map((a) => (
                  <Card key={a.id} withBorder padding="sm">
                    <Text size="sm" fw={600}>
                      {a.job.title}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {a.job.company} · {a.source.displayName}
                    </Text>
                    <Text size="xs" mt={4}>
                      {a.resumeVersion.resume.name} v{a.resumeVersion.version}
                    </Text>
                    <Badge size="xs" variant="light" mt={6}>
                      {modeLabels[a.mode] ?? a.mode}
                    </Badge>
                  </Card>
                ))}
              </Stack>
            );
          })}
        </SimpleGrid>
      </ScrollArea>
    </Stack>
  );
}
