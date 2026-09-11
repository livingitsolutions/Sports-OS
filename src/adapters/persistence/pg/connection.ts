import postgres from "postgres";

/**
 * PostgreSQL connection/runtime configuration for the persistence adapters.
 *
 * This is the ONLY place a database connection is constructed. Repository
 * adapters receive an already-constructed `Sql` client; they never read
 * environment variables or build connections themselves. Domain and application
 * code never import this module (enforced by the layer rules) — infrastructure
 * configuration lives entirely in adapters/composition.
 */

export type Sql = postgres.Sql<Record<string, never>>;

export interface PgConfig {
  readonly connectionString: string;
}

/**
 * Reads the database connection string from the environment. Prefers a generic
 * `DATABASE_URL`, falling back to the provisioned `SUPABASE_DB_URL`. Throws a
 * clear error when neither is configured, so production wiring fails loudly
 * instead of silently degrading.
 */
export function readPgConfigFromEnv(): PgConfig {
  const connectionString =
    process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL ?? "";
  if (connectionString.trim().length === 0) {
    throw new Error(
      "Database configuration is missing: set DATABASE_URL (or SUPABASE_DB_URL) " +
        "to a PostgreSQL connection string before starting the production container.",
    );
  }
  return { connectionString };
}

/**
 * Constructs the pooled Postgres client. SSL is required for hosted providers
 * (e.g. Supabase) and disabled for local/loopback test databases, inferred from
 * the connection string.
 */
export function createSql(config: PgConfig): Sql {
  return postgres(config.connectionString, {
    max: 10,
    ssl: sslOption(config.connectionString),
    onnotice: () => {},
  });
}

function sslOption(connectionString: string): "require" | false {
  const lower = connectionString.toLowerCase();
  if (lower.includes("sslmode=disable")) return false;
  if (lower.includes("@localhost") || lower.includes("@127.0.0.1")) return false;
  return "require";
}
