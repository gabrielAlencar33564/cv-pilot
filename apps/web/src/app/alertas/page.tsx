'use client';

import { Badge, Button, Card, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { IconChecks } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useApiMutation } from '@/features/shared/queries';
import { api } from '@/lib/api';
import type { NotificationRow } from '@/lib/types';

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const dayFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' });

/** O que cada tipo de alerta diz e para onde leva. */
function describe(n: NotificationRow): { title: string; detail: string; href: string } {
  switch (n.kind) {
    case 'needs_action':
      return {
        title: 'Uma candidatura precisa de você',
        detail: 'Conclua o envio no site da vaga e marque como enviada no painel.',
        href: '/applications',
      };
    case 'resume_parse_failed':
      return {
        title: 'Não conseguimos ler um currículo',
        detail: 'Envie o arquivo de novo, em PDF ou DOCX com texto selecionável.',
        href: '/resumes',
      };
    case 'new_jobs':
      return {
        title:
          n.data.count === 1
            ? '1 vaga nova para os seus perfis'
            : `${n.data.count} vagas novas para os seus perfis`,
        // o dia vem como AAAA-MM-DD, no fuso do usuário
        detail: `Resumo de ${dayFormat.format(new Date(`${n.data.day}T00:00:00Z`))}.`,
        href: '/jobs',
      };
    case 'follow_ups_due':
      return {
        title:
          n.data.count === 1
            ? '1 candidatura sem resposta há uma semana'
            : `${n.data.count} candidaturas sem resposta há uma semana`,
        detail: 'Uma mensagem educada costuma ajudar. A mensagem pronta está no card, no painel.',
        href: '/applications',
      };
  }
}

/** Alertas dentro do app (RF-70/71), no lugar do e-mail por enquanto. */
export default function AlertsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => api<{ items: NotificationRow[]; unreadCount: number }>('/notifications'),
  });
  const readAll = useApiMutation<Record<string, never>>({
    path: '/notifications/read-all',
    invalidate: ['notifications'],
  });
  const readOne = useApiMutation<{ id: string }>({
    path: (b) => `/notifications/${b.id}/read`,
    invalidate: ['notifications'],
  });
  const items = data?.items ?? [];

  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Title order={2}>Alertas</Title>
          <Text c="dimmed" size="sm">
            Vagas novas, candidaturas que precisam de você ou de um follow-up e currículos com
            problema.
          </Text>
        </div>
        <Button
          variant="light"
          leftSection={<IconChecks size={16} />}
          disabled={!data?.unreadCount}
          loading={readAll.isPending}
          onClick={() => readAll.mutate({})}
        >
          Marcar tudo como lido
        </Button>
      </Group>

      {isLoading && <Loader size="sm" />}
      {error && <Text c="red">Não foi possível carregar os alertas.</Text>}
      {!isLoading && !error && items.length === 0 && (
        <Text c="dimmed">
          Nenhum alerta por enquanto. O resumo de vagas novas sai todo dia às 8h.
        </Text>
      )}

      {items.map((n) => {
        const { title, detail, href } = describe(n);
        const unread = !n.readAt;
        return (
          <Card key={n.id} withBorder bg={unread ? 'var(--mantine-color-blue-light)' : undefined}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Stack gap={2} style={{ minWidth: 0 }}>
                <Group gap="xs">
                  <Text fw={600}>{title}</Text>
                  {unread && (
                    <Badge size="xs" variant="filled">
                      Novo
                    </Badge>
                  )}
                </Group>
                {n.subject && <Text size="sm">{n.subject}</Text>}
                <Text size="sm" c="dimmed">
                  {detail}
                </Text>
                <Text size="xs" c="dimmed">
                  {dateTime.format(new Date(n.createdAt))}
                </Text>
              </Stack>
              <Group gap="xs" wrap="nowrap">
                {unread && (
                  <Button
                    size="compact-sm"
                    variant="subtle"
                    onClick={() => readOne.mutate({ id: n.id })}
                  >
                    Marcar como lido
                  </Button>
                )}
                <Button
                  size="compact-sm"
                  variant="light"
                  component={Link}
                  href={href}
                  onClick={() => {
                    if (unread) readOne.mutate({ id: n.id });
                  }}
                >
                  Ver
                </Button>
              </Group>
            </Group>
          </Card>
        );
      })}
    </Stack>
  );
}
