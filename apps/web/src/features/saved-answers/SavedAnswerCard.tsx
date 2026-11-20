'use client';

import type { SavedAnswerRow, SavedAnswerUpdateInput } from '@cv-pilot/contracts';
import { ActionIcon, Badge, Button, Card, Group, Text, Textarea } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { useApiMutation } from '@/features/shared/queries';

/** Uma pergunta do banco: responder, mudar a resposta ou pedir para excluir. */
export function SavedAnswerCard({
  saved,
  onDelete,
}: {
  saved: SavedAnswerRow;
  onDelete: (saved: SavedAnswerRow) => void;
}) {
  const [answer, setAnswer] = useState(saved.answer ?? '');
  const update = useApiMutation<SavedAnswerUpdateInput>({
    path: `/saved-answers/${saved.id}`,
    method: 'PUT',
    invalidate: ['saved-answers'],
    success: 'Resposta salva',
  });
  const changed = answer.trim() !== (saved.answer ?? '');

  return (
    <Card withBorder>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Text fw={600} style={{ minWidth: 0 }}>
          {saved.question}
        </Text>
        <Group gap={4} wrap="nowrap">
          {saved.timesSeen > 1 && (
            <Badge variant="light" color="gray">
              apareceu {saved.timesSeen}×
            </Badge>
          )}
          <ActionIcon
            variant="subtle"
            color="red"
            aria-label={`Excluir a pergunta "${saved.question}"`}
            onClick={() => onDelete(saved)}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Group>
      <Textarea
        mt="xs"
        label="Sua resposta"
        aria-label={`Resposta para "${saved.question}"`}
        autosize
        minRows={1}
        maxRows={8}
        maxLength={2000}
        value={answer}
        onChange={(e) => setAnswer(e.currentTarget.value)}
      />
      <Group justify="flex-end" mt="xs">
        <Button
          size="xs"
          disabled={!changed}
          loading={update.isPending}
          onClick={() => update.mutate({ answer })}
        >
          Salvar resposta
        </Button>
      </Group>
    </Card>
  );
}
