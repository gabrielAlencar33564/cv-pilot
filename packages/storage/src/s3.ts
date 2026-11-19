import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { decryptFile, encryptFile, encryptionKeyFromEnv } from './crypto';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não definida: configure no .env (veja .env.example)`);
  return value;
}

let connection: { client: S3Client; bucket: string } | undefined;

function s3() {
  connection ??= {
    client: new S3Client({
      endpoint: requiredEnv('S3_ENDPOINT'),
      region: requiredEnv('S3_REGION'),
      credentials: {
        accessKeyId: requiredEnv('S3_ACCESS_KEY'),
        secretAccessKey: requiredEnv('S3_SECRET_KEY'),
      },
      // SeaweedFS (e outros S3 compatíveis) usam endpoint/bucket/chave, não bucket.endpoint
      forcePathStyle: true,
      // os checksums que o SDK manda por padrão não são aceitos por todo S3 compatível
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    }),
    bucket: requiredEnv('S3_BUCKET'),
  };
  return connection;
}

/**
 * Chave do objeto (`<userId>/<resumeId>/<versão>-<uuid>.<ext>`), gerada no servidor; o nome original
 * do arquivo fica só como metadado no banco. O bucket já é o dos currículos.
 */
export function resumeStorageKey(file: {
  userId: string;
  resumeId: string;
  version: number;
  extension: string;
}): string {
  return `${file.userId}/${file.resumeId}/${file.version}-${randomUUID()}.${file.extension}`;
}

/** Cifra (AES-256-GCM) e grava. O storage nunca recebe o currículo em claro. */
export async function storeResumeFile(key: string, plain: Uint8Array): Promise<void> {
  const { client, bucket } = s3();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: encryptFile(plain, encryptionKeyFromEnv()),
      ContentType: 'application/octet-stream',
    }),
  );
}

export async function loadResumeFile(key: string): Promise<Buffer> {
  const { client, bucket } = s3();
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) throw new Error(`objeto vazio no storage: ${key}`);
  return decryptFile(await response.Body.transformToByteArray(), encryptionKeyFromEnv());
}

export async function deleteResumeFile(key: string): Promise<void> {
  const { client, bucket } = s3();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
