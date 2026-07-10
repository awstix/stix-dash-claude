declare module "better-sqlite3" {
  type StatementResult = {
    changes: number;
    lastInsertRowid: bigint | number;
  };

  type Statement = {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): StatementResult;
  };

  class Database {
    constructor(filename: string, options?: { readonly?: boolean });

    close(): void;
    exec(sql: string): void;
    pragma(sql: string): unknown;
    prepare(sql: string): Statement;
    transaction<T extends (...args: never[]) => unknown>(fn: T): T;
  }

  export default Database;
}
