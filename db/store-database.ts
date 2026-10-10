export type StoreResult<T = Record<string, unknown>> = {
  results: T[];
  meta: { changes: number };
  success: boolean;
};
export interface StoreStatement {
  bind(...values: unknown[]): StoreStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<StoreResult<T>>;
  run<T = Record<string, unknown>>(): Promise<StoreResult<T>>;
}
export interface StoreDatabase {
  prepare(sql: string): StoreStatement;
  batch(statements: StoreStatement[]): Promise<StoreResult[]>;
}
