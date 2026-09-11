import type {
  PersonPersistenceError,
  PersonRepository,
} from "@app/contracts/person-repository";
import type { Person } from "@domain/identity/identity.types";
import type { Id, Result } from "@shared/kernel";
import type { Sql } from "@adapters/persistence/pg/connection";
import {
  isUniqueViolation,
  neutralDetail,
  pgErrorInfo,
} from "@adapters/persistence/pg/errors";
import type { PersonRow } from "@adapters/persistence/pg/mappers";
import { toPerson } from "@adapters/persistence/pg/mappers";

/**
 * PostgreSQL PersonRepository.
 *
 * Persists the Person aggregate together with its one-to-one Sports ID inside a
 * single database transaction, so a successful create can never leave a Person
 * without a Sports ID or a Sports ID without a Person. Uniqueness (Person ID,
 * public Sports ID, one-Sports-ID-per-Person) is enforced by database
 * constraints; conflicts are translated into typed `PersonPersistenceError`
 * outcomes. No driver error escapes this adapter.
 */
export class PgPersonRepository implements PersonRepository {
  constructor(private readonly sql: Sql) {}

  async create(
    person: Person,
  ): Promise<Result<Person, PersonPersistenceError>> {
    if (person.sportsId === null) {
      return {
        ok: false,
        error: { kind: "unavailable", detail: "A Person must carry a Sports ID." },
      };
    }
    const sportsId = person.sportsId;

    try {
      await this.sql.begin(async (tx) => {
        await tx`
          INSERT INTO persons (id, display_name, date_of_birth, lifecycle_status)
          VALUES (
            ${person.id},
            ${person.displayName},
            ${person.dateOfBirth},
            ${person.lifecycleStatus}
          )
        `;
        await tx`
          INSERT INTO sports_ids (value, person_id, issued_at, status)
          VALUES (
            ${sportsId.value},
            ${person.id},
            ${sportsId.issuedAt},
            ${sportsId.status}
          )
        `;
      });
      return { ok: true, value: person };
    } catch (err) {
      return { ok: false, error: mapCreateError(err) };
    }
  }

  async findBySportsId(sportsId: Id<"SportsId">): Promise<Person | null> {
    const rows = await this.read(
      () => this.sql<PersonRow[]>`
        SELECT
          p.id,
          p.display_name,
          p.date_of_birth::text AS date_of_birth,
          p.lifecycle_status,
          s.value AS sports_id_value,
          s.issued_at AS sports_id_issued_at,
          s.status AS sports_id_status
        FROM persons p
        JOIN sports_ids s ON s.person_id = p.id
        WHERE s.value = ${sportsId}
        LIMIT 1
      `,
    );
    const row = rows[0];
    return row !== undefined ? toPerson(row) : null;
  }

  async findById(personId: Id<"Person">): Promise<Person | null> {
    const rows = await this.read(
      () => this.sql<PersonRow[]>`
        SELECT
          p.id,
          p.display_name,
          p.date_of_birth::text AS date_of_birth,
          p.lifecycle_status,
          s.value AS sports_id_value,
          s.issued_at AS sports_id_issued_at,
          s.status AS sports_id_status
        FROM persons p
        LEFT JOIN sports_ids s ON s.person_id = p.id
        WHERE p.id = ${personId}
        LIMIT 1
      `,
    );
    const row = rows[0];
    return row !== undefined ? toPerson(row) : null;
  }

  private async read<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (err) {
      throw new Error(`person_repository_read_failed: ${neutralDetail(err)}`);
    }
  }
}

function mapCreateError(err: unknown): PersonPersistenceError {
  const info = pgErrorInfo(err);
  if (isUniqueViolation(info) && info !== null) {
    if (info.constraint.includes("persons_pkey")) {
      return { kind: "duplicate_person_id" };
    }
    // Any Sports ID uniqueness conflict (public value or one-per-person).
    return { kind: "duplicate_sports_id" };
  }
  return { kind: "unavailable", detail: neutralDetail(err) };
}
