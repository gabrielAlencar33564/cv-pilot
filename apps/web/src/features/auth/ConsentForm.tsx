'use client';

import { TERMS_VERSION } from '@cv-pilot/contracts';
import { Alert, Anchor, Button, Checkbox, Stack, Text } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { acceptTerms } from '@/lib/session';
import { AuthCard } from './AuthCard';

/** Aparece quando a conta ainda não aceitou a versão atual dos termos (RF-03). */
export function ConsentForm() {
  const [checked, setChecked] = useState(false);
  const aceite = useMutation({
    mutationFn: acceptTerms,
    onSuccess: () => window.location.assign('/'),
  });

  return (
    <AuthCard
      title="Antes de continuar, aceite os termos atuais."
      footer={{ text: 'Prefere sair?', linkLabel: 'Voltar para a entrada', href: '/login' }}
    >
      <Stack>
        <Text size="sm">
          Os termos de uso e a política de privacidade estão na versão {TERMS_VERSION}. Eles
          explicam que dados guardamos, para quê e com quem compartilhamos.
        </Text>
        {aceite.error && (
          <Alert color="red" variant="light">
            Não foi possível registrar o aceite. Tente de novo.
          </Alert>
        )}
        <Checkbox
          checked={checked}
          onChange={(e) => setChecked(e.currentTarget.checked)}
          label={
            <>
              Li e aceito os{' '}
              <Anchor component={Link} href="/termos" target="_blank">
                termos de uso e a política de privacidade
              </Anchor>
            </>
          }
        />
        <Button disabled={!checked} loading={aceite.isPending} onClick={() => aceite.mutate()}>
          Aceitar e continuar
        </Button>
      </Stack>
    </AuthCard>
  );
}
