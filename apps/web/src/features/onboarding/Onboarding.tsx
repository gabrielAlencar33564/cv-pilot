'use client';

import type { ProfileSuggestion } from '@cv-pilot/contracts';
import { Anchor, Card, Loader, Stack, Stepper, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import type { SendRuleRow } from '@/lib/types';
import { ResumeStep } from './ResumeStep';
import { SuggestedProfilesForm } from './SuggestedProfilesForm';

const STEPS = [
  { label: 'Currículo', description: 'Envie o arquivo' },
  { label: 'Perfis', description: 'Revise as sugestões' },
  { label: 'Sites', description: 'Onde buscar' },
];

/** Primeiro acesso, sem perfil de busca: do currículo aos perfis em três passos. */
export function Onboarding() {
  const [active, setActive] = useState(0);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const suggestions = useQuery({
    queryKey: ['profile-suggestions', resumeId],
    queryFn: () =>
      api<{ suggestions: ProfileSuggestion[] }>(`/resumes/${resumeId}/profile-suggestions`),
    enabled: resumeId !== null,
  });
  const rules = useQuery({
    queryKey: ['send-rules'],
    queryFn: () => api<SendRuleRow[]>('/send-rules'),
  });

  return (
    <Stack>
      <div>
        <Title order={2}>Vamos começar</Title>
        <Text c="dimmed">
          Envie seu currículo e o CV Pilot sugere o que buscar. Você revisa tudo antes de salvar.{' '}
          <Anchor component={Link} href="/search-profiles" size="sm">
            Prefiro configurar à mão
          </Anchor>
        </Text>
      </div>

      <Stepper active={active} size="sm">
        {STEPS.map((s) => (
          <Stepper.Step key={s.label} label={s.label} description={s.description} />
        ))}
      </Stepper>

      <Card withBorder padding="lg">
        {active === 0 && (
          <ResumeStep
            onReady={(id) => {
              setResumeId(id);
              setActive(1);
            }}
          />
        )}
        {active > 0 && (suggestions.isLoading || rules.isLoading) && <Loader size="sm" />}
        {active > 0 && suggestions.error && (
          <Text c="red">Não foi possível sugerir perfis agora. Tente de novo em instantes.</Text>
        )}
        {active > 0 && resumeId && suggestions.data && rules.data && (
          // fica montado entre os passos 2 e 3: o que foi revisado não se perde
          <SuggestedProfilesForm
            resumeId={resumeId}
            suggestions={suggestions.data.suggestions}
            hasSendRules={rules.data.length > 0}
            step={active === 1 ? 'review' : 'sites'}
            onNext={() => setActive(2)}
            onBack={() => setActive(active - 1)}
          />
        )}
      </Card>
    </Stack>
  );
}
