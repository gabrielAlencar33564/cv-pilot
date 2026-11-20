import type { JobRequirement, RequirementsCheck } from '@cv-pilot/contracts';
import { Anchor, Badge, Group, Stack, Text } from '@mantine/core';
import Link from 'next/link';

function RequirementBadges({ items, color }: { items: JobRequirement[]; color: string }) {
  return (
    <Group gap={6}>
      {items.map((r) => (
        <Badge key={r.name} color={color} variant="light" tt="none">
          {r.name}
        </Badge>
      ))}
    </Group>
  );
}

/** O que a vaga pede e o currículo não mostra (RF-41). */
export function RequirementsGaps({ check }: { check: RequirementsCheck }) {
  if (check.status === 'not_analyzed') {
    return (
      <Text size="sm" c="dimmed">
        Os requisitos desta vaga ainda não foram analisados. A análise é feita para as vagas que
        passam da nota mínima do perfil.
      </Text>
    );
  }
  if (check.status === 'no_resume') {
    return (
      <Text size="sm" c="dimmed">
        <Anchor component={Link} href="/resumes">
          Envie um currículo
        </Anchor>{' '}
        e espere a leitura para ver o que falta.
      </Text>
    );
  }

  const { missing, met } = check;
  if (!missing.length && !met.length) {
    return (
      <Text size="sm" c="dimmed">
        A vaga não lista requisitos que dê para conferir no currículo.
      </Text>
    );
  }
  const required = missing.filter((r) => r.required);
  const niceToHave = missing.filter((r) => !r.required);

  return (
    <Stack gap="xs">
      {missing.length === 0 ? (
        <Text size="sm">Seu currículo mostra todos os {met.length} requisitos da vaga.</Text>
      ) : (
        <>
          {required.length > 0 && (
            <Stack gap={4}>
              <Text size="sm" fw={600}>
                Exigidos que não aparecem no currículo
              </Text>
              <RequirementBadges items={required} color="red" />
            </Stack>
          )}
          {niceToHave.length > 0 && (
            <Stack gap={4}>
              <Text size="sm" fw={600}>
                Diferenciais que não aparecem no currículo
              </Text>
              <RequirementBadges items={niceToHave} color="gray" />
            </Stack>
          )}
          <Text size="xs" c="dimmed">
            A comparação é pelo texto do currículo. Se você tem algum desses e ele não está escrito,
            vale incluir.
          </Text>
        </>
      )}
      {met.length > 0 && missing.length > 0 && (
        <Text size="sm" c="dimmed">
          O currículo já mostra: {met.map((r) => r.name).join(', ')}.
        </Text>
      )}
    </Stack>
  );
}
