import type { SportDirectory } from "@app/contracts/sport-directory";
import type { Id } from "@shared/kernel";
import type { Sql } from "@adapters/persistence/pg/connection";
import { neutralDetail } from "@adapters/persistence/pg/errors";

/**
 * PostgreSQL SportDirectory.
 *
 * A read-only existence check over the platform `sports` reference table — NOT a
 * catalog CRUD surface. It stands in for the future Sports Catalog query port
 * while remaining a pure lookup. No driver error escapes this adapter.
 */
export class PgSportDirectory implements SportDirectory {
  constructor(private readonly sql: Sql) {}

  async exists(sportId: Id<"Sport">): Promise<boolean> {
    try {
      const rows = await this.sql<{ readonly one: number }[]>`
        SELECT 1 AS one FROM sports WHERE id = ${sportId} LIMIT 1
      `;
      return rows.length > 0;
    } catch (err) {
      throw new Error(`sport_directory_read_failed: ${neutralDetail(err)}`);
    }
  }
}
