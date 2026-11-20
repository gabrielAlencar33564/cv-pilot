import { TERMS_VERSION } from '@cv-pilot/contracts';
import { Alert, Anchor, Container, List, ListItem, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';

export const metadata = { title: 'Termos de uso e privacidade · CV Pilot' };

/** Termos de uso e política de privacidade (RF-03). Mudou o texto, mude TERMS_VERSION. */
export default function TermsPage() {
  return (
    <Container size="md" py="xl">
      <Stack>
        <Anchor component={Link} href="/" size="sm">
          ← CV Pilot
        </Anchor>
        <Title order={1}>Termos de uso e política de privacidade</Title>
        <Text c="dimmed">Versão {TERMS_VERSION}</Text>
        <Alert color="yellow" variant="light" title="Rascunho">
          Este texto descreve o que o sistema faz hoje e ainda precisa de revisão jurídica antes de
          receber usuários reais.
        </Alert>

        <Title order={2}>1. O que é o CV Pilot</Title>
        <Text>
          O CV Pilot ajuda você a encontrar vagas e se candidatar. Você cadastra o que procura e os
          seus currículos; bots buscam vagas em sites públicos, calculam a compatibilidade e
          preparam candidaturas, que você revisa antes de enviar.
        </Text>

        <Title order={2}>2. Sua conta</Title>
        <List>
          <ListItem>
            Você entra com e-mail e senha. A senha é guardada só como hash, nunca em claro.
          </ListItem>
          <ListItem>
            Você é responsável pelo que for enviado em seu nome e pode revisar cada candidatura.
          </ListItem>
          <ListItem>
            Os bots nunca contornam CAPTCHA, login ou bloqueio de nenhum site. Quando isso aparece,
            a candidatura fica como &quot;Ação necessária&quot; para você concluir.
          </ListItem>
        </List>

        <Title order={2}>3. Dados que tratamos e para quê</Title>
        <List>
          <ListItem>
            <b>Conta:</b> nome, e-mail e senha (como hash), para identificar você.
          </ListItem>
          <ListItem>
            <b>Currículos:</b> os arquivos que você envia e os dados extraídos deles (resumo,
            experiências, formação, habilidades e idiomas), para calcular a compatibilidade com as
            vagas e preparar candidaturas.
          </ListItem>
          <ListItem>
            <b>Preferências e candidaturas:</b> perfis de busca, regras de envio, candidaturas e
            suas anotações, para o sistema funcionar como você configurou.
          </ListItem>
          <ListItem>
            <b>Registro do aceite:</b> versão destes termos, data e IP, como prova do consentimento.
          </ListItem>
        </List>

        <Title order={2}>4. Com quem compartilhamos</Title>
        <List>
          <ListItem>
            <b>Anthropic (Claude):</b> o arquivo do currículo é enviado para extrair os dados
            estruturados. Isso pode ser uma transferência internacional de dados. Não pedimos
            documentos como CPF ou RG, e eles não são extraídos.
          </ListItem>
          <ListItem>
            <b>Voyage AI:</b> o resumo, as habilidades e as experiências extraídas do currículo, e o
            texto das vagas, viram vetores numéricos (embeddings) para medir a semelhança entre o
            seu currículo e cada vaga. Isso pode ser uma transferência internacional de dados. Nome,
            contatos e documentos não são enviados.
          </ListItem>
          <ListItem>
            <b>Sites de vagas:</b> só quando uma candidatura é enviada, com os dados que você
            escolheu para ela.
          </ListItem>
          <ListItem>Não vendemos nem cedemos seus dados para publicidade.</ListItem>
        </List>

        <Title order={2}>5. Segurança e retenção</Title>
        <List>
          <ListItem>
            Os arquivos de currículo ficam cifrados (AES-256-GCM) no armazenamento.
          </ListItem>
          <ListItem>Os registros do sistema guardam identificadores, não dados pessoais.</ListItem>
          <ListItem>Seus dados ficam guardados enquanto a conta existir.</ListItem>
        </List>

        <Title order={2}>6. Seus direitos (LGPD)</Title>
        <Text>
          Na página da conta você pode corrigir seus dados, exportar tudo o que está guardado e
          excluir a conta. A exclusão apaga os arquivos e os dados de forma definitiva.
        </Text>

        <Title order={2}>7. Cookies</Title>
        <Text>
          Usamos só o cookie da sessão de login, necessário para você continuar conectado. Não há
          cookies de publicidade nem de rastreamento.
        </Text>

        <Title order={2}>8. Mudanças nestes termos</Title>
        <Text>
          Quando estes termos mudarem, a versão muda e você precisa aceitar de novo antes de
          continuar usando o sistema.
        </Text>
      </Stack>
    </Container>
  );
}
