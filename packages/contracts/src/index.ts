export * from './enums';
export * from './search-profile';
export * from './send-rule';
export * from './job';
export * from './resume';
export * from './consent';
export * from './account';
export * from './application';
export * from './cover-letter';
export * from './notification';

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
