# ADR 0002: Currículos cifrados na aplicação antes de ir ao S3

- **Status:** aceita
- **Data:** 2026-11-18

## Contexto

O RNF-05 (LGPD) pede currículos criptografados em repouso. O storage hoje é o SeaweedFS no Docker e pode virar R2 ou S3 depois. Depender da criptografia do próprio storage amarraria a proteção ao provedor e à configuração de cada ambiente.

## Decisão

- **Cifra na aplicação.** O pacote `packages/storage` cifra cada arquivo com AES-256-GCM antes do `PutObject` e decifra depois do `GetObject`.
- **Chave:** `ENCRYPTION_KEY`, 32 bytes em base64. Não há padrão: sem a chave, nada é gravado.
- **Formato do objeto:** `id da chave (1 byte) | IV (12) | tag (16) | texto cifrado`.
  - O IV é aleatório por arquivo.
  - A tag do GCM recusa arquivo alterado ou chave errada.
  - O id permite rotacionar a chave sem perder o que já foi gravado.
- **A chave do objeto é gerada no servidor:** `<userId>/<resumeId>/<versão>-<uuid>.<ext>`. O nome original do arquivo fica só no banco, como metadado, e sai mascarado nos logs (`fileName` em `SENSITIVE_FIELDS`).
- **O upload é validado pelo conteúdo**, não pela extensão (`detectResumeFileType` no `core`):
  - PDF começa com `%PDF-`;
  - DOCX é um zip com `word/document.xml`;
  - o tamanho máximo é 5 MB.

## Consequências

- **Download por URL pré-assinada** (skill `lgpd-seguranca`) entregaria só o arquivo cifrado. Quando a pré-visualização chegar, a API vai servir o arquivo decifrado depois de conferir o dono, em vez de assinar uma URL.
- **Trocar a `ENCRYPTION_KEY`** sem migrar os objetos deixa os currículos antigos ilegíveis. Uma rotação precisa de outro id de chave, com a antiga mantida para leitura.
- **A mesma primitiva serve para os tokens OAuth** (RNF-05), quando eles existirem.
