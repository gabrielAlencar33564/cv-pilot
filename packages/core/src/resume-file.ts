/** Formatos de currículo aceitos no upload, com o MIME e a extensão gravados no servidor. */
export const RESUME_FILE_TYPES = {
  pdf: { mimeType: 'application/pdf', extension: 'pdf' },
  docx: {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: 'docx',
  },
} as const;

export type ResumeFileType = keyof typeof RESUME_FILE_TYPES;

const PDF_MAGIC = Buffer.from('%PDF-');
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
// Os nomes das entradas de um zip ficam sem compressão nos cabeçalhos; um DOCX sempre tem esta.
const DOCX_ENTRY = Buffer.from('word/document.xml');

/**
 * Identifica o formato pelo conteúdo, não pela extensão nem pelo MIME enviado pelo cliente.
 * Retorna null para tudo que não for PDF ou DOCX (inclusive outros zips, como XLSX).
 */
export function detectResumeFileType(content: Uint8Array): ResumeFileType | null {
  const bytes = Buffer.from(content.buffer, content.byteOffset, content.byteLength);
  if (bytes.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) return 'pdf';
  if (bytes.subarray(0, ZIP_MAGIC.length).equals(ZIP_MAGIC) && bytes.includes(DOCX_ENTRY)) {
    return 'docx';
  }
  return null;
}
