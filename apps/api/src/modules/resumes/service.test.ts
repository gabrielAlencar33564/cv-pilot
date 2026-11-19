import { describe, expect, it } from 'vitest';
import { inlineDisposition } from './service';

describe('inlineDisposition', () => {
  it('mantém o nome original em UTF-8 e uma versão ASCII para navegadores antigos', () => {
    expect(inlineDisposition('Currículo João.pdf')).toBe(
      `inline; filename="Curr_culo Jo_o.pdf"; filename*=UTF-8''Curr%C3%ADculo%20Jo%C3%A3o.pdf`,
    );
  });

  it('não deixa aspas nem barra invertida quebrarem o cabeçalho', () => {
    expect(inlineDisposition('cv"x\\y.pdf')).toMatch(/^inline; filename="cv_x_y\.pdf";/);
  });
});
