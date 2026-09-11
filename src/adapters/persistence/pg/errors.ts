import postgres from "postgres";

/**
 * Translation of raw PostgreSQL/driver failures into the typed application
 * persistence outcomes each repository contract already defines. No SQLSTATE
 * code, constraint name, or driver exception ever escapes an adapter into the
 * application or domain layers.
 */

const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

interface PgErrorInfo {
  readonly code: string;
  readonly constraint: string;
  readonly detail: string;
}

/** Extracts the fields we key error mapping on, if this is a Postgres error. */
export function pgErrorInfo(err: unknown): PgErrorInfo | null {
  if (err instanceof postgres.PostgresError) {
    return {
      code: err.code,
      constraint: err.constraint_name ?? "",
      detail: err.message,
    };
  }
  return null;
}

export function isUniqueViolation(info: PgErrorInfo | null): boolean {
  return info !== null && info.code === UNIQUE_VIOLATION;
}

export function isForeignKeyViolation(info: PgErrorInfo | null): boolean {
  return info !== null && info.code === FOREIGN_KEY_VIOLATION;
}

/**
 * A neutral, driver-free description safe to attach to an `unavailable` outcome.
 * Deliberately omits SQLSTATE, connection strings, and stack traces.
 */
export function neutralDetail(err: unknown): string {
  const info = pgErrorInfo(err);
  if (info !== null) return "Database rejected the operation.";
  if (err instanceof Error && err.message.length > 0) {
    return "Database is unavailable.";
  }
  return "Database is unavailable.";
}
