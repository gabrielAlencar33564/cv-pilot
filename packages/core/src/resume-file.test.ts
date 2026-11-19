import { describe, expect, it } from 'vitest';
import { detectResumeFileType } from './resume-file';

const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(
    Buffer.concat(
      parts.map((p) => (typeof p === 'string' ? Buffer.from(p, 'latin1') : Buffer.from(p))),
    ),
  );

const ZIP = [0x50, 0x4b, 0x03, 0x04];

describe('detectResumeFileType', () => {
  it('reconhece PDF pelo cabeçalho %PDF-', () => {
    expect(detectResumeFileType(bytes('%PDF-1.7\n...'))).toBe('pdf');
  });

  it('reconhece DOCX: zip com word/document.xml', () => {
    expect(detectResumeFileType(bytes(ZIP, '....[Content_Types].xml....word/document.xml'))).toBe(
      'docx',
    );
  });

  it('recusa outros zips, como uma planilha XLSX', () => {
    expect(detectResumeFileType(bytes(ZIP, '....xl/workbook.xml'))).toBeNull();
  });

  it('recusa arquivo com extensão de PDF mas outro conteúdo', () => {
    expect(detectResumeFileType(bytes('<html>não sou um PDF</html>'))).toBeNull();
  });

  it('recusa arquivo vazio', () => {
    expect(detectResumeFileType(new Uint8Array())).toBeNull();
  });

  it('respeita o recorte de um Uint8Array que aponta para o meio de outro buffer', () => {
    const base = bytes('lixo', '%PDF-1.4');
    expect(detectResumeFileType(base.subarray(4))).toBe('pdf');
  });
});
