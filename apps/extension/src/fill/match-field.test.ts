import { describe, expect, it } from 'vitest';
import {
  isResumeInput,
  matchField,
  pickOption,
  questionOf,
  type FieldInfo,
  type FillData,
} from './match-field';

const data: FillData = {
  profile: {
    name: 'Ana Maria Souza',
    email: 'ana@exemplo.test',
    phone: '(11) 99999-0000',
    city: 'São Paulo',
    links: { linkedin: 'https://linkedin.com/in/ana', github: null, portfolio: null },
    salaryExpectation: 8000,
    availability: 'Imediata',
  },
  coverLetter: 'Olá, equipe da Acme!',
  answers: {
    'Por que você quer trabalhar aqui?': 'Gosto do produto.',
    'Pretensão salarial': '9000',
  },
};

const campo = (o: Partial<FieldInfo>): FieldInfo => ({
  tag: 'input',
  type: 'text',
  label: '',
  name: '',
  id: '',
  placeholder: '',
  autocomplete: '',
  ...o,
});

describe('matchField', () => {
  it.each([
    [{ label: 'Nome completo' }, 'Ana Maria Souza', 'name'],
    [{ label: 'Primeiro nome' }, 'Ana', 'firstName'],
    [{ label: 'Sobrenome' }, 'Maria Souza', 'lastName'],
    [{ label: 'E-mail' }, 'ana@exemplo.test', 'email'],
    [{ type: 'email', name: 'contato' }, 'ana@exemplo.test', 'email'],
    [{ label: 'Celular / WhatsApp' }, '(11) 99999-0000', 'phone'],
    [{ name: 'linkedin_url' }, 'https://linkedin.com/in/ana', 'linkedin'],
    [{ placeholder: 'Cidade onde mora' }, 'São Paulo', 'city'],
    [{ autocomplete: 'given-name', name: 'x1' }, 'Ana', 'firstName'],
    [{ label: 'Disponibilidade para início' }, 'Imediata', 'availability'],
  ] as const)('%o recebe %s', (info, valor, origem) => {
    expect(matchField(campo(info), data)).toEqual({ value: valor, source: origem });
  });

  it('a resposta padrão da regra vence o perfil, sem acento nem maiúscula', () => {
    expect(matchField(campo({ label: 'PRETENSAO SALARIAL (R$)' }), data)).toEqual({
      value: '9000',
      source: 'answer',
    });
    expect(
      matchField(campo({ tag: 'textarea', label: 'Por que você quer trabalhar aqui?' }), data),
    ).toEqual({ value: 'Gosto do produto.', source: 'answer' });
  });

  it('sem resposta padrão, a pretensão vem do perfil', () => {
    expect(matchField(campo({ label: 'Pretensão salarial' }), { ...data, answers: {} })).toEqual({
      value: '8000',
      source: 'salary',
    });
  });

  it('a carta vai só em área de texto', () => {
    expect(matchField(campo({ tag: 'textarea', label: 'Carta de apresentação' }), data)).toEqual({
      value: 'Olá, equipe da Acme!',
      source: 'coverLetter',
    });
    expect(matchField(campo({ label: 'Carta de apresentação' }), data)).toBeNull();
  });

  it('"nome da empresa" não é o nome do candidato', () => {
    expect(matchField(campo({ label: 'Nome da empresa atual' }), data)).toBeNull();
  });

  it('nunca preenche senha, arquivo, escolhas ou botões', () => {
    for (const type of ['password', 'file', 'checkbox', 'radio', 'submit', 'hidden']) {
      expect(matchField(campo({ type, label: 'E-mail' }), data)).toBeNull();
    }
  });

  it('campo do perfil vazio fica em branco, em vez de receber outro dado', () => {
    expect(matchField(campo({ label: 'GitHub' }), data)).toBeNull();
  });

  it('campo desconhecido fica como está', () => {
    expect(matchField(campo({ label: 'Como soube da vaga?' }), data)).toBeNull();
  });
});

describe('questionOf', () => {
  it('o rótulo do campo vazio é a pergunta, com os espaços arrumados', () => {
    expect(questionOf(campo({ label: '  Possui   CNH?  ' }))).toBe('Possui CNH?');
    expect(questionOf(campo({ tag: 'select', label: 'Nível de inglês' }))).toBe('Nível de inglês');
    expect(questionOf(campo({ placeholder: 'Quanto tempo de experiência?' }))).toBe(
      'Quanto tempo de experiência?',
    );
  });

  it('arquivo, senha e escolhas não viram pergunta', () => {
    for (const type of ['file', 'password', 'checkbox', 'radio', 'hidden']) {
      expect(questionOf(campo({ type, label: 'Possui CNH?' }))).toBeNull();
    }
  });

  it('rótulo curto demais ou longo demais não vira pergunta', () => {
    expect(questionOf(campo({ label: 'Sim' }))).toBeNull();
    expect(questionOf(campo({ label: 'x'.repeat(301) }))).toBeNull();
    expect(questionOf(campo({ name: 'campo_sem_rotulo' }))).toBeNull();
  });
});

describe('isResumeInput', () => {
  it('reconhece o campo do currículo pelo texto', () => {
    expect(isResumeInput({ label: 'Anexe seu currículo', name: '', id: '' }, 3)).toBe(true);
    expect(isResumeInput({ label: '', name: 'resume_file', id: '' }, 2)).toBe(true);
  });

  it('com um campo de arquivo só, ele é o do currículo', () => {
    expect(isResumeInput({ label: 'Arquivo', name: '', id: '' }, 1)).toBe(true);
    expect(isResumeInput({ label: 'Foto', name: '', id: '' }, 2)).toBe(false);
  });
});

describe('pickOption', () => {
  it('acha a opção igual, depois a que contém o valor', () => {
    expect(pickOption(['Selecione', 'São Paulo', 'Rio de Janeiro'], 'sao paulo')).toBe(1);
    expect(pickOption(['Selecione', 'Até R$ 9000', 'Mais'], '9000')).toBe(1);
    expect(pickOption(['Selecione', 'Sim'], 'Talvez')).toBe(-1);
  });
});
