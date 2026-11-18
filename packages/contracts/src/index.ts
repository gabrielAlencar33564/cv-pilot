export * from './enums';
export * from './search-profile';
export * from './send-rule';
export * from './job';

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
