import type { ResumeParseStatus } from '@cv-pilot/contracts';

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
  workModels: string[];
  sourceIds: string[];
  frequencyMinutes: number;
  minScoreAutoApply: number;
  active: boolean;
}

export interface SendRuleRow {
  id: string;
  sourceId: string | null;
  searchProfileId: string | null;
  tone: string;
  mode: string;
  reviewBeforeSend: boolean;
  generateCoverLetter: boolean;
  resume: { id: string; name: string };
  source: { displayName: string } | null;
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
}

export interface ApplicationRow {
  id: string;
  status: string;
  mode: string;
  score: number | null;
  updatedAt: string;
  job: { title: string; company: string };
  source: { displayName: string };
  resumeVersion: { version: number; resume: { name: string } };
}
