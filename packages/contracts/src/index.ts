export * from './enums';
export * from './search-profile';
export * from './send-rule';
export * from './job';
export * from './job-requirements';
export * from './resume';
export * from './consent';
export * from './account';
export * from './application';
export * from './application-metrics';
export * from './cover-letter';
export * from './cover-letter-draft';
export * from './extension';
export * from './saved-answer';
export * from './notification';

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
export * from './admin';
export * from './company-suggestion';
