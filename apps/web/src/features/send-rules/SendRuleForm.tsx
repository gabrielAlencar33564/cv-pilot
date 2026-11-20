'use client';

import type { ApplyMode, LetterTone, SendRuleInput } from '@cv-pilot/contracts';
import {
  ActionIcon,
  Anchor,
  Button,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm, type UseFormReturnType } from '@mantine/form';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import Link from 'next/link';
import {
  useApiMutation,
  useCoverLetterTemplates,
  useResumes,
  useSearchProfiles,
  useSources,
} from '@/features/shared/queries';
import { modeLabels, toOptions, toneLabels } from '@/lib/labels';
import type { SendRuleRow } from '@/lib/types';

const ALL = '__all__';
const NO_TEMPLATE = '__none__';

type Answer = { question: string; answer: string };

type RuleValues = {
  sourceId: string;
  searchProfileId: string;
  resumeId: string;
  coverLetterTemplateId: string;
  tone: LetterTone;
  mode: ApplyMode;
  generateCoverLetter: boolean;
  reviewBeforeSend: boolean;
  /** lista no formulário para editar a pergunta; vira um objeto na API */
  answers: Answer[];
};

function toValues(rule?: SendRuleRow): RuleValues {
  return {
    sourceId: rule?.sourceId ?? ALL,
    searchProfileId: rule?.searchProfileId ?? ALL,
    resumeId: rule?.resumeId ?? '',
    coverLetterTemplateId: rule?.coverLetterTemplateId ?? NO_TEMPLATE,
    tone: rule?.tone ?? 'technical',
    mode: rule?.mode ?? 'assisted',
    generateCoverLetter: rule?.generateCoverLetter ?? false,
    reviewBeforeSend: rule?.reviewBeforeSend ?? true,
    answers: Object.entries(rule?.defaultAnswers ?? {}).map(([question, answer]) => ({
      question,
      answer,
    })),
  };
}

const toInput = ({ answers, ...v }: RuleValues): SendRuleInput => ({
  ...v,
  sourceId: v.sourceId === ALL ? null : v.sourceId,
  searchProfileId: v.searchProfileId === ALL ? null : v.searchProfileId,
  coverLetterTemplateId: v.coverLetterTemplateId === NO_TEMPLATE ? null : v.coverLetterTemplateId,
  defaultAnswers: Object.fromEntries(
    answers.filter((a) => a.question.trim()).map((a) => [a.question.trim(), a.answer.trim()]),
  ),
});

const sameQuestion = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Pergunta vazia só é aceita na linha toda vazia; pergunta repetida sobrescreveria a outra. */
function validateQuestion(value: string, values: RuleValues, path: string) {
  const index = Number(path.split('.')[1]);
  if (!value.trim()) return values.answers[index]?.answer.trim() ? 'Escreva a pergunta' : null;
  const first = values.answers.findIndex((a) => sameQuestion(a.question, value));
  return first === index ? null : 'Pergunta repetida';
}

/** Respostas que o bot usa nas perguntas frequentes dos formulários de candidatura. */
function DefaultAnswersInput({ form }: { form: UseFormReturnType<RuleValues> }) {
  return (
    <Stack gap="xs">
      <div>
        <Text size="sm" fw={500}>
          Respostas padrão
        </Text>
        <Text size="xs" c="dimmed">
          Ex.: &quot;Pretensão salarial&quot; → &quot;R$ 8.000&quot;. Perguntas sem resposta aqui
          deixam a candidatura em &quot;Ação necessária&quot;.
        </Text>
      </div>
      {form.values.answers.map((_, index) => (
        <Group key={form.key(`answers.${index}`)} align="flex-start" gap="xs" wrap="nowrap">
          <TextInput
            placeholder="Pergunta"
            aria-label={`Pergunta ${index + 1}`}
            style={{ flex: 1 }}
            {...form.getInputProps(`answers.${index}.question`)}
          />
          <TextInput
            placeholder="Resposta"
            aria-label={`Resposta ${index + 1}`}
            style={{ flex: 1 }}
            {...form.getInputProps(`answers.${index}.answer`)}
          />
          <ActionIcon
            variant="subtle"
            color="red"
            mt={6}
            aria-label={`Remover resposta ${index + 1}`}
            onClick={() => form.removeListItem('answers', index)}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      ))}
      <Group>
        <Button
          variant="light"
          size="compact-sm"
          leftSection={<IconPlus size={14} />}
          onClick={() => form.insertListItem('answers', { question: '', answer: '' })}
        >
          Adicionar resposta
        </Button>
      </Group>
    </Stack>
  );
}

/** Cria ou edita (com `rule`) uma regra de envio (RF-22). */
export function SendRuleForm({ rule, onDone }: { rule?: SendRuleRow; onDone: () => void }) {
  const { data: sources = [] } = useSources();
  const { data: resumes = [] } = useResumes();
  const { data: profiles = [] } = useSearchProfiles();
  const { data: templates = [] } = useCoverLetterTemplates();
  const save = useApiMutation<SendRuleInput>({
    path: rule ? `/send-rules/${rule.id}` : '/send-rules',
    method: rule ? 'PUT' : 'POST',
    invalidate: ['send-rules'],
    success: 'Regra de envio salva',
  });

  const form = useForm<RuleValues>({
    initialValues: toValues(rule),
    validate: {
      resumeId: (v) => (v ? null : 'Escolha um currículo'),
      answers: { question: validateQuestion },
    },
  });

  return (
    <form onSubmit={form.onSubmit((v) => save.mutate(toInput(v), { onSuccess: onDone }))}>
      <Stack>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select
            label="Site"
            data={[
              { value: ALL, label: 'Todos os sites (padrão)' },
              ...sources.map((s) => ({ value: s.id, label: s.displayName })),
            ]}
            allowDeselect={false}
            {...form.getInputProps('sourceId')}
          />
          <Select
            label="Perfil de busca"
            data={[
              { value: ALL, label: 'Todos os perfis' },
              ...profiles.map((p) => ({ value: p.id, label: p.name })),
            ]}
            allowDeselect={false}
            {...form.getInputProps('searchProfileId')}
          />
        </SimpleGrid>
        <Select
          label="Currículo a enviar"
          placeholder="Escolha"
          data={resumes.map((r) => ({ value: r.id, label: r.name }))}
          nothingFoundMessage="Cadastre um currículo primeiro"
          {...form.getInputProps('resumeId')}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select
            label="Modelo de carta"
            description={
              <>
                Preenchido com a empresa, o cargo e o seu nome.{' '}
                <Anchor component={Link} href="/cartas" size="xs">
                  Gerenciar modelos
                </Anchor>
              </>
            }
            data={[
              { value: NO_TEMPLATE, label: 'Sem carta' },
              ...templates.map((t) => ({ value: t.id, label: t.name })),
            ]}
            allowDeselect={false}
            {...form.getInputProps('coverLetterTemplateId')}
          />
          <Select
            label="Tom da carta"
            data={toOptions(toneLabels)}
            allowDeselect={false}
            {...form.getInputProps('tone')}
          />
        </SimpleGrid>
        <Select
          label="Modo de envio"
          data={toOptions(modeLabels)}
          allowDeselect={false}
          {...form.getInputProps('mode')}
        />
        <Switch
          label="Gerar carta de apresentação com IA"
          description="A IA escreve uma carta para cada vaga, no tom escolhido, só com o que está no seu currículo. O modelo acima fica de reserva se ela falhar. Você pode editar antes de enviar."
          {...form.getInputProps('generateCoverLetter', { type: 'checkbox' })}
        />
        <Switch
          label="Revisar antes de enviar"
          {...form.getInputProps('reviewBeforeSend', { type: 'checkbox' })}
        />
        <DefaultAnswersInput form={form} />
        <Group justify="flex-end">
          <Button type="submit" loading={save.isPending}>
            Salvar regra
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
