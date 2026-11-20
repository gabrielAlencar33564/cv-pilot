import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

/**
 * O endereço aponta para a rede interna, para fora de http(s) ou para uma porta incomum. Vale
 * para endereços que vêm do usuário (a página de carreiras do "Adicionar empresa"): o bot nunca
 * acessa o Postgres, o Redis, o S3 ou os metadados da nuvem em nome de alguém.
 */
export class UnsafeUrlError extends Error {
  constructor(public readonly host: string) {
    super(`Endereço não permitido: ${host}`);
    this.name = 'UnsafeUrlError';
  }
}

/** Faixas que não são a internet pública (RFC 6890 e afins). */
const PRIVATE_RANGES = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  PRIVATE_RANGES.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  PRIVATE_RANGES.addSubnet(network, prefix, 'ipv6');
}

/**
 * IPv4 escrito como IPv6 (::ffff:127.0.0.1): nenhum site público precisa dele. Fica numa lista
 * à parte porque o BlockList compara IPv4 com esta faixa, e ela casaria com qualquer IPv4.
 */
const IPV4_MAPPED = new BlockList();
IPV4_MAPPED.addSubnet('::ffff:0:0', 96, 'ipv6');

function isPrivate(address: string, family: number): boolean {
  if (family !== 6) return PRIVATE_RANGES.check(address, 'ipv4');
  return PRIVATE_RANGES.check(address, 'ipv6') || IPV4_MAPPED.check(address, 'ipv6');
}

const ALLOWED_PORTS = new Set(['', '80', '443']);

type Resolve = (host: string) => Promise<{ address: string; family: number }[]>;
const resolveAll: Resolve = (host) => lookup(host, { all: true });

/**
 * Confere, antes de cada requisição, que o endereço é público: http(s), porta padrão e todos
 * os IPs do nome fora das faixas privadas. Resta a troca de DNS entre esta conferência e a
 * conexão (DNS rebinding), que pediria fixar o IP no próprio fetch.
 */
export async function assertPublicUrl(url: URL, resolve: Resolve = resolveAll): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (
    (url.protocol !== 'https:' && url.protocol !== 'http:') ||
    !ALLOWED_PORTS.has(url.port) ||
    host === 'localhost' ||
    host.endsWith('.localhost')
  ) {
    throw new UnsafeUrlError(url.host);
  }
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await resolve(host);
  const unsafe = addresses.some(({ address, family }) => isPrivate(address, family));
  if (unsafe || !addresses.length) throw new UnsafeUrlError(url.host);
}
