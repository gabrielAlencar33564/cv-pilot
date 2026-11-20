'use client';

import { SavedAnswerInput, type SavedAnswerRow } from '@cv-pilot/contracts';
import {
  Button,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { SavedAnswerCard } from '@/features/saved-answers/SavedAnswerCard';
import { useApiMutation } from '@/features/shared/queries';
import { api } from '@/lib/api';

/** Pergunta escrita à mão, antes de algum formulário fazê-la. */
function NewQuestionForm({ onDone }: { onDone: () => void }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const create = useApiMutation<SavedAnswerInput>({
    path: '/saved-answers',
    invalidate: ['saved-answers'],
    success: 'Pergunta salva',
  });
  const valid = SavedAnswerInput.safeParse({ question, answer }).success;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) create.mutate({ question, answer }, { onSuccess: onDone });
      }}
    >
      <Stack>
        <TextInput
          label="Pergunta"
          placeholder="Possui disponibilidade para viagens?"
          value={question}
          onChange={(e) => setQuestion(e.currentTarget.value)}
          data-autofocus
        />
        <Textarea
          label="Resposta"
          autosize
          minRows={2}
          value={answer}
          onChange={(e) => setAnswer(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!valid} loading={create.isPending}>
            Salvar
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/**
 * Banco de respostas (ADR 0011): as perguntas que a extensão encontrou nos formulários e não
 * soube responder. Respondidas uma vez, ela preenche nas próximas vagas.
 */
export default function SavedAnswersPage() {
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState<SavedAnswerRow | null>(null);
  const {
    data: answers = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['saved-answers'],
    queryFn: () => api<SavedAnswerRow[]>('/saved-answers'),
  });
  const remove = useApiMutation<{ id: string }>({
    path: (b) => `/saved-answers/${b.id}`,
    method: 'DELETE',
    invalidate: ['saved-answers'],
    success: 'Pergunta excluída',
  });
  const pending = answers.filter((a) => a.answer === null);
  const answered = answers.filter((a) => a.answer !== null);

  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Title order={2}>Banco de respostas</Title>
          <Text c="dimmed" size="sm">
            As perguntas que a extensão encontrou nos formulários e não soube responder. Responda
            uma vez, e ela preenche nas próximas vagas. As respostas padrão da regra de envio de
            cada site têm prioridade sobre estas.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setAdding(true)}>
          Nova pergunta
        </Button>
      </Group>

      {isLoading && <Loader size="sm" />}
      {error && <Text c="red">Não foi possível carregar o banco de respostas.</Text>}
      {!isLoading && !error && answers.length === 0 && (
        <Text c="dimmed">
          Nenhuma pergunta ainda. Quando a extensão preencher um formulário, as perguntas que ela
          não souber responder aparecem aqui.
        </Text>
      )}

      {pending.length > 0 && (
        <Stack gap="xs">
          <Title order={4}>Sem resposta ({pending.length})</Title>
          {pending.map((a) => (
            <SavedAnswerCard key={a.id} saved={a} onDelete={setToDelete} />
          ))}
        </Stack>
      )}
      {answered.length > 0 && (
        <Stack gap="xs">
          <Title order={4}>Respondidas ({answered.length})</Title>
          {answered.map((a) => (
            <SavedAnswerCard key={a.id} saved={a} onDelete={setToDelete} />
          ))}
        </Stack>
      )}

      <Modal opened={adding} onClose={() => setAdding(false)} title="Nova pergunta">
        <NewQuestionForm onDone={() => setAdding(false)} />
      </Modal>

      <Modal opened={toDelete !== null} onClose={() => setToDelete(null)} title="Excluir pergunta">
        <Stack>
          <Text size="sm">
            A pergunta <b>{toDelete?.question}</b> sai do banco. Se um formulário fizer a mesma
            pergunta de novo, ela volta, sem resposta.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setToDelete(null)}>
              Cancelar
            </Button>
            <Button
              color="red"
              loading={remove.isPending}
              onClick={() =>
                toDelete &&
                remove.mutate({ id: toDelete.id }, { onSuccess: () => setToDelete(null) })
              }
            >
              Excluir
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
