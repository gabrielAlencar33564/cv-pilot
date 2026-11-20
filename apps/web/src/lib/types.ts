import type {
  ApplicationStatus,
  ContractType,
  CoverLetterStatus,
  LetterTone,
  NotificationContent,
  ApplyMode,
  FollowUpState,
  RequirementsCheck,
  ResumeParseStatus,
  Seniority,
  WorkModel,
} from '@cv-pilot/contracts';

// Formatos retornados pela API (subconjunto usado na interface).
export interface Source {
  id: string;
  displayName: string;
  kind: string;
  applyModes: string[];
}

export interface Resume {
  id: string;
  name: string;
  description?: string | null;
  tags: string[];
  versions: ResumeVersionSummary[];
}

export interface ResumeVersionSummary {
  id: string;
  version: number;
  fileName: string;
  mimeType: string;
  parseStatus: ResumeParseStatus;
  parseError: string | null;
  createdAt: string;
}

export interface SearchProfileRow {
  id: string;
  name: string;
  keywords: string[];
  excludeKeywords: string[];
  seniorities: Seniority[];
  workModels: WorkModel[];
  contractTypes: ContractType[];
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  companyBlacklist: string[];
  sourceIds: string[];
  frequencyMinutes: number;
  dailyApplyLimit: number;
  minScoreAutoApply: number;
  active: boolean;
}

export interface SendRuleRow {
  id: string;
  sourceId: string | null;
  searchProfileId: string | null;
  resumeId: string;
  coverLetterTemplateId: string | null;
  tone: LetterTone;
  mode: ApplyMode;
  reviewBeforeSend: boolean;
  generateCoverLetter: boolean;
  defaultAnswers: Record<string, string>;
  resume: { id: string; name: string };
  source: { displayName: string } | null;
}

export interface CoverLetterTemplateRow {
  id: string;
  name: string;
  body: string;
  updatedAt: string;
}

export interface JobMatchRow {
  id: string;
  score: number;
  reasons: string[];
  searchProfile: { id: string; name: string };
  job: {
    id: string;
    title: string;
    company: string;
    location: string | null;
    workModel: string | null;
    sources: { sourceId: string; url: string }[];
  };
  /** candidatura a esta vaga, se já existe (por qualquer perfil) */
  application: { id: string; status: string } | null;
}

/** `GET /jobs/:id`: a vaga completa, o que falta (RF-41) e o que vai ser enviado (RF-24). */
export interface JobMatchDetail extends Omit<JobMatchRow, 'job'> {
  job: JobMatchRow['job'] & {
    description: string;
    seniority: string | null;
    contractType: string | null;
    salaryMin: number | null;
    salaryMax: number | null;
  };
  requirements: RequirementsCheck;
  preview: {
    sourceId: string | null;
    rule: {
      id: string;
      mode: string;
      tone: string;
      reviewBeforeSend: boolean;
      defaultAnswers: Record<string, string>;
    } | null;
    resume: {
      id: string;
      name: string;
      version: { id: string; version: number; fileName: string; parseStatus: string } | null;
    } | null;
    coverLetter: string | null;
    coverLetterStatus: CoverLetterStatus | null;
    /**
     * a carta é a da candidatura; sem isso, é a que a regra daria ao se candidatar (e
     * `generating` quer dizer que a IA vai escrevê-la)
     */
    coverLetterFromApplication: boolean;
  };
}

export interface ApplicationRow {
  id: string;
  status: string;
  mode: string;
  score: number | null;
  updatedAt: string;
  notes: string | null;
  coverLetter: string | null;
  coverLetterStatus: CoverLetterStatus | null;
  /** a carta ainda pode mudar: a candidatura não saiu */
  coverLetterEditable: boolean;
  /** para onde o candidato pode mover a candidatura à mão (máquina de estados do core) */
  allowedTransitions: ApplicationStatus[];
  /** sem resposta há uma semana (`due`) ou mesmo depois do follow-up (`stale`) */
  followUp: FollowUpState | null;
  /** mensagem pronta para cobrar a empresa, só quando o follow-up venceu */
  followUpMessage: string | null;
  job: { title: string; company: string };
  source: { displayName: string };
  resumeVersion: { version: number; resume: { name: string } };
}

/** `GET /me`: perfil base e situação do aceite dos termos. */
export interface Me {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  city: string | null;
  links: { linkedin?: string | null; github?: string | null; portfolio?: string | null };
  salaryExpectation: number | null;
  availability: string | null;
  termsVersion: string;
  termsAcceptedAt: string | null;
  consentRequired: boolean;
  /** só decide se o menu mostra o admin; a API confere o papel em cada rota /admin */
  isAdmin: boolean;
}

/** `GET /notifications`: o alerta e o texto que identifica a vaga ou o currículo. */
export type NotificationRow = NotificationContent & {
  id: string;
  readAt: string | null;
  createdAt: string;
  subject: string | null;
};
