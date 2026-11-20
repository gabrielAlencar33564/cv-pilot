'use client';

import { Alert, Card, Loader, Stack, Text, Title } from '@mantine/core';
import { ExtensionSection } from '@/features/account/ExtensionSection';
import { PasswordForm } from '@/features/account/PasswordForm';
import { PrivacySection } from '@/features/account/PrivacySection';
import { ProfileForm } from '@/features/account/ProfileForm';
import { useMe } from '@/features/shared/queries';

export default function AccountPage() {
  const { data: me, isLoading, error } = useMe();

  return (
    <Stack>
      <div>
        <Title order={2}>Minha conta</Title>
        <Text c="dimmed" size="sm">
          Seus dados de contato, a senha, a extensão do navegador e o que fazer com os seus dados.
        </Text>
      </div>
      {isLoading && <Loader />}
      {error && (
        <Alert color="red" variant="light">
          Não foi possível carregar a conta. Tente de novo.
        </Alert>
      )}
      {me && (
        <>
          <Card withBorder>
            <Title order={4} mb="sm">
              Perfil
            </Title>
            <ProfileForm me={me} />
          </Card>
          <Card withBorder>
            <Title order={4} mb="sm">
              Senha
            </Title>
            <PasswordForm />
          </Card>
          <Card withBorder>
            <Title order={4} mb="sm">
              Extensão do navegador
            </Title>
            <ExtensionSection />
          </Card>
          <Card withBorder>
            <Title order={4} mb="sm">
              Seus dados
            </Title>
            <PrivacySection me={me} />
          </Card>
        </>
      )}
    </Stack>
  );
}
