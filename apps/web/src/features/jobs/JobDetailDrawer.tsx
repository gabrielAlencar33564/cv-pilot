'use client';

import {
  Alert,
  Anchor,
  Badge,
  Divider,
  Drawer,
  Group,
  List,
  ListItem,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api, apiUrl } from '@/lib/api';
import { modeLabels, parseStatusLabels, toneLabels, workModelLabels } from '@/lib/labels';
import type { JobMatchDetail } from '@/lib/types';
import { JobActions } from './JobActions';
import { RequirementsGaps } from './RequirementsGaps';

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

function salaryText(min: number | null, max: number | null) {
  if (min && max) return `${money.format(min)} a ${money.format(max)}`;
  const value = min ?? max;
  return value ? money.format(value) : null;
}

/** Exatamente o que vai para a vaga (RF-24): currículo, modo de envio, respostas e carta. */
function SendPreview({ preview }: { preview: JobMatchDetail['preview'] }) {
  if (!preview.rule || !preview.resume) {
    return (
      <Alert variant="light" color="yellow">
        Nenhuma regra de envio vale para este site.{' '}
        <Anchor component={Link} href="/send-rules">
          Configure uma regra
        </Anchor>{' '}
        para poder se candidatar.
      </Alert>
    );
  }
  const { rule, resume } = preview;
  const version = resume.version;
  const answers = Object.entries(rule.defaultAnswers);

  return (
    <Stack gap={6}>
      <Text size="sm">
        <b>Currículo:</b> {resume.name}
        {version ? (
          <>
            {' '}
            (versão {version.version} ·{' '}
            <Anchor
              href={apiUrl(`/resumes/${resume.id}/versions/${version.id}/file`)}
              target="_blank"
            >
              {version.fileName}
            </Anchor>
            )
          </>
        ) : (
          <>
            {' '}
            ·{' '}
            <Anchor component={Link} href="/resumes">
              sem arquivo enviado
            </Anchor>
          </>
        )}
      </Text>
      {version && (
        <Text size="xs" c="dimmed">
          Dados do currículo:{' '}
          {parseStatusLabels[version.parseStatus as keyof typeof parseStatusLabels]?.label ??
            version.parseStatus}
        </Text>
      )}
      <Text size="sm">
        <b>Envio:</b> {modeLabels[rule.mode] ?? rule.mode}
        {rule.reviewBeforeSend ? ' · com revisão antes de enviar' : ''}
      </Text>
      {preview.coverLetter ? (
        <Stack gap={4}>
          <Text size="sm" fw={600}>
            Carta
          </Text>
          <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
            {preview.coverLetter}
          </Text>
        </Stack>
      ) : (
        <Text size="sm">
          <b>Carta:</b> sem carta.{' '}
          <Anchor component={Link} href="/send-rules">
            Escolha um modelo na regra de envio
          </Anchor>{' '}
          (tom {toneLabels[rule.tone] ?? rule.tone}).
        </Text>
      )}
      <Text size="sm" fw={600}>
        Respostas padrão
      </Text>
      {answers.length ? (
        <List size="sm">
          {answers.map(([question, answer]) => (
            <ListItem key={question}>
              {question}: {answer}
            </ListItem>
          ))}
        </List>
      ) : (
        <Text size="sm" c="dimmed">
          Nenhuma configurada na regra.
        </Text>
      )}
    </Stack>
  );
}

/** Detalhes da vaga e o que falta (RF-41), pré-visualização (RF-24) e as ações. */
export function JobDetailDrawer({
  matchId,
  onClose,
}: {
  matchId: string | null;
  onClose: () => void;
}) {
  const {
    data: match,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['jobs', 'detail', matchId],
    queryFn: () => api<JobMatchDetail>(`/jobs/${matchId}`),
    enabled: matchId !== null,
  });
  const salary = match && salaryText(match.job.salaryMin, match.job.salaryMax);

  return (
    <Drawer
      opened={matchId !== null}
      onClose={onClose}
      position="right"
      size="lg"
      title="Detalhes da vaga"
    >
      {isLoading && <Loader />}
      {error && (
        <Alert color="red" variant="light">
          Não foi possível carregar a vaga.
        </Alert>
      )}
      {match && (
        <Stack>
          <div>
            <Title order={3}>{match.job.title}</Title>
            <Text>
              {match.job.company}
              {match.job.location ? ` · ${match.job.location}` : ''}
            </Text>
          </div>
          <Group gap={6}>
            <Badge>{match.score}% de compatibilidade</Badge>
            {match.job.workModel && (
              <Badge variant="outline">{workModelLabels[match.job.workModel]}</Badge>
            )}
            {salary && <Badge variant="light">{salary}</Badge>}
            <Badge variant="light" color="gray">
              {match.searchProfile.name}
            </Badge>
          </Group>
          {match.reasons.length > 0 && (
            <Text size="sm" c="dimmed">
              {match.reasons.join(' · ')}
            </Text>
          )}
          <Group gap="xs">
            {match.job.sources.map((s) => (
              <Anchor key={s.sourceId} href={s.url} target="_blank" size="sm">
                Ver no site ({s.sourceId})
              </Anchor>
            ))}
          </Group>

          <Divider label="O que falta" labelPosition="left" />
          <RequirementsGaps check={match.requirements} />

          <Divider label="O que vai ser enviado" labelPosition="left" />
          <SendPreview preview={match.preview} />
          <JobActions match={match} onDone={onClose} />

          <Divider label="Descrição" labelPosition="left" />
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {match.job.description || 'O site não trouxe a descrição.'}
          </Text>
        </Stack>
      )}
    </Drawer>
  );
}
