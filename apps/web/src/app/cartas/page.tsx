'use client';

import { ActionIcon, Button, Card, Group, Loader, Modal, Stack, Text, Title } from '@mantine/core';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { CoverLetterTemplateForm } from '@/features/cover-letters/CoverLetterTemplateForm';
import { useApiMutation, useCoverLetterTemplates } from '@/features/shared/queries';
import type { CoverLetterTemplateRow } from '@/lib/types';

/** O modal cria um modelo novo (`template` ausente) ou edita um existente. */
type Editor = { template?: CoverLetterTemplateRow };

export default function CoverLettersPage() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const { data: templates = [], isLoading, error } = useCoverLetterTemplates();
  const remove = useApiMutation<{ id: string }>({
    path: (b) => `/cover-letter-templates/${b.id}`,
    method: 'DELETE',
    // as regras que usavam o modelo ficam sem carta
    invalidate: ['cover-letter-templates', 'send-rules'],
    success: 'Modelo removido',
  });
  const close = () => setEditor(null);

  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Title order={2}>Modelos de carta</Title>
          <Text c="dimmed" size="sm">
            Escolha um modelo na regra de envio de cada site. A carta vai preenchida com a empresa,
            o cargo e o seu nome.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setEditor({})}>
          Novo modelo
        </Button>
      </Group>

      {isLoading && <Loader size="sm" />}
      {error && <Text c="red">Não foi possível carregar os modelos.</Text>}
      {!isLoading && !error && templates.length === 0 && (
        <Text c="dimmed">Nenhum modelo ainda. Sem modelo, as candidaturas vão sem carta.</Text>
      )}

      {templates.map((t) => (
        <Card key={t.id} withBorder>
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Stack gap={4} style={{ minWidth: 0 }}>
              <Text fw={600}>{t.name}</Text>
              <Text size="sm" c="dimmed" lineClamp={3} style={{ whiteSpace: 'pre-line' }}>
                {t.body}
              </Text>
            </Stack>
            <Group gap={4} wrap="nowrap">
              <ActionIcon
                variant="subtle"
                aria-label={`Editar ${t.name}`}
                onClick={() => setEditor({ template: t })}
              >
                <IconPencil size={16} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label={`Remover ${t.name}`}
                onClick={() => remove.mutate({ id: t.id })}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          </Group>
        </Card>
      ))}

      <Modal
        opened={editor !== null}
        onClose={close}
        title={editor?.template ? 'Editar modelo de carta' : 'Novo modelo de carta'}
        size="lg"
      >
        {editor && <CoverLetterTemplateForm template={editor.template} onDone={close} />}
      </Modal>
    </Stack>
  );
}
