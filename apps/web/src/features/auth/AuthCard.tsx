import { Anchor, Card, Center, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';
import type { ReactNode } from 'react';

/** Moldura das telas de entrada e cadastro, com o link para a outra tela. */
export function AuthCard(props: {
  title: string;
  children: ReactNode;
  footer: { text: string; linkLabel: string; href: string };
}) {
  return (
    <Center mih="80vh">
      <Card withBorder shadow="sm" padding="xl" w="100%" maw={420}>
        <Stack>
          <div>
            <Title order={2}>CV Pilot</Title>
            <Text c="dimmed">{props.title}</Text>
          </div>
          {props.children}
          <Text size="sm" ta="center">
            {props.footer.text}{' '}
            <Anchor component={Link} href={props.footer.href}>
              {props.footer.linkLabel}
            </Anchor>
          </Text>
        </Stack>
      </Card>
    </Center>
  );
}
