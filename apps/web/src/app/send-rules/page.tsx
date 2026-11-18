'use client';

import { ActionIcon, Alert, Badge, Button, Group, Modal, Stack, Table, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconInfoCircle, IconPlus, IconTrash } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { SendRuleForm } from '@/features/send-rules/SendRuleForm';
import { useApiMutation, useSearchProfiles } from '@/features/shared/queries';
import { api } from '@/lib/api';
import { modeLabels, toneLabels } from '@/lib/labels';
import type { SendRuleRow } from '@/lib/types';

export default function SendRulesPage() {
  const [opened, { open, close }] = useDisclosure();
  const { data: rules = [] } = useQuery({ queryKey: ['send-rules'], queryFn: () => api<SendRuleRow[]>('/send-rules') });
  const { data: profiles = [] } = useSearchProfiles();
  const remove = useApiMutation<{ id: string }>({
    path: (b) => `/send-rules/${b.id}`,
    method: 'DELETE',
    invalidate: ['send-rules'],
    success: 'Regra removida',
  });
  const profileName = (id: string | null) => (id ? (profiles.find((p) => p.id === id)?.name ?? id) : 'Todos');

  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Title order={2}>Envio por site</Title>
          <Text c="dimmed" size="sm">
            Escolha qual currículo e qual tom usar em cada site de vagas.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          Nova regra
        </Button>
      </Group>

      <Alert icon={<IconInfoCircle />} variant="light">
        Quando mais de uma regra se aplica, vale a mais específica: perfil + site → site → perfil → padrão.
      </Alert>

      <Table striped withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Site</Table.Th>
            <Table.Th>Perfil de busca</Table.Th>
            <Table.Th>Currículo</Table.Th>
            <Table.Th>Tom</Table.Th>
            <Table.Th>Modo</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rules.map((r) => (
            <Table.Tr key={r.id}>
              <Table.Td>{r.source?.displayName ?? <Badge variant="outline">Padrão</Badge>}</Table.Td>
              <Table.Td>{profileName(r.searchProfileId)}</Table.Td>
              <Table.Td>{r.resume.name}</Table.Td>
              <Table.Td>{toneLabels[r.tone] ?? r.tone}</Table.Td>
              <Table.Td>{modeLabels[r.mode] ?? r.mode}</Table.Td>
              <Table.Td>
                <ActionIcon variant="subtle" color="red" aria-label="Remover regra" onClick={() => remove.mutate({ id: r.id })}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {rules.length === 0 && <Text c="dimmed">Nenhuma regra. Crie ao menos a regra padrão.</Text>}

      <Modal opened={opened} onClose={close} title="Nova regra de envio" size="lg">
        <SendRuleForm onDone={close} />
      </Modal>
    </Stack>
  );
}
