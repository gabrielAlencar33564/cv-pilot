'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconInfoCircle, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { SendRuleForm } from '@/features/send-rules/SendRuleForm';
import {
  useApiMutation,
  useCoverLetterTemplates,
  useSearchProfiles,
} from '@/features/shared/queries';
import { api } from '@/lib/api';
import { modeLabels, toneLabels } from '@/lib/labels';
import type { SendRuleRow } from '@/lib/types';

/** O modal cria uma regra nova (`rule` ausente) ou edita uma existente. */
type Editor = { rule?: SendRuleRow };

export default function SendRulesPage() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const { data: rules = [] } = useQuery({
    queryKey: ['send-rules'],
    queryFn: () => api<SendRuleRow[]>('/send-rules'),
  });
  const { data: profiles = [] } = useSearchProfiles();
  const { data: templates = [] } = useCoverLetterTemplates();
  const remove = useApiMutation<{ id: string }>({
    path: (b) => `/send-rules/${b.id}`,
    method: 'DELETE',
    invalidate: ['send-rules'],
    success: 'Regra removida',
  });
  const profileName = (id: string | null) =>
    id ? (profiles.find((p) => p.id === id)?.name ?? id) : 'Todos';
  const templateName = (id: string | null) =>
    id ? (templates.find((t) => t.id === id)?.name ?? '—') : 'Sem carta';
  const close = () => setEditor(null);

  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Title order={2}>Envio por site</Title>
          <Text c="dimmed" size="sm">
            Escolha qual currículo, carta e respostas usar em cada site de vagas.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setEditor({})}>
          Nova regra
        </Button>
      </Group>

      <Alert icon={<IconInfoCircle />} variant="light">
        Quando mais de uma regra se aplica, vale a mais específica: perfil + site → site → perfil →
        padrão.
      </Alert>

      <Table.ScrollContainer minWidth={720}>
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Site</Table.Th>
              <Table.Th>Perfil de busca</Table.Th>
              <Table.Th>Currículo</Table.Th>
              <Table.Th>Carta</Table.Th>
              <Table.Th>Tom</Table.Th>
              <Table.Th>Modo</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rules.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>
                  {r.source?.displayName ?? <Badge variant="outline">Padrão</Badge>}
                </Table.Td>
                <Table.Td>{profileName(r.searchProfileId)}</Table.Td>
                <Table.Td>{r.resume.name}</Table.Td>
                <Table.Td>{templateName(r.coverLetterTemplateId)}</Table.Td>
                <Table.Td>{toneLabels[r.tone] ?? r.tone}</Table.Td>
                <Table.Td>{modeLabels[r.mode] ?? r.mode}</Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      aria-label="Editar regra"
                      onClick={() => setEditor({ rule: r })}
                    >
                      <IconPencil size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label="Remover regra"
                      onClick={() => remove.mutate({ id: r.id })}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {rules.length === 0 && <Text c="dimmed">Nenhuma regra. Crie ao menos a regra padrão.</Text>}

      <Modal
        opened={editor !== null}
        onClose={close}
        title={editor?.rule ? 'Editar regra de envio' : 'Nova regra de envio'}
        size="lg"
      >
        {editor && <SendRuleForm rule={editor.rule} onDone={close} />}
      </Modal>
    </Stack>
  );
}
