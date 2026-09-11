import type { PersonLookupResult, PersonPersistenceError, PersonRepository } from "@app/contracts/person-repository";
import type { Sql } from "@adapters/persistence/pg/connection";
import { isUniqueViolation, neutralDetail, pgErrorInfo } from "@adapters/persistence/pg/errors";
import type { PersonRow } from "@adapters/persistence/pg/mappers";
import { toPerson } from "@adapters/persistence/pg/mappers";
import type { AggregateVersion } from "@domain/aggregate";
import type { Person } from "@domain/identity/identity.types";
import type { Id, Result } from "@shared/kernel";

export class PgPersonRepository implements PersonRepository {
  constructor(private readonly sql: Sql) {}

  async create(person: Person): Promise<Result<Person, PersonPersistenceError>> {
    if (person.version !== 1 || person.sportsId === null) return invalidState("A new Person must carry a Sports ID at version 1.");
    try {
      const sportsId = person.sportsId;
      await this.sql.begin(async (tx) => {
        await tx`INSERT INTO persons (id, display_name, date_of_birth, lifecycle_status, version, updated_at)
          VALUES (${person.id}, ${person.displayName}, ${person.dateOfBirth}, ${person.lifecycleStatus}, ${person.version}, ${person.updatedAt})`;
        await tx`INSERT INTO sports_ids (value, person_id, issued_at, status)
          VALUES (${sportsId.value}, ${person.id}, ${sportsId.issuedAt}, ${sportsId.status})`;
      });
      return { ok: true, value: person };
    } catch (error) { return { ok: false, error: mapCreateError(error) }; }
  }

  findBySportsId(sportsId: Id<"SportsId">): Promise<PersonLookupResult> {
    return this.read(() => this.sql<PersonRow[]>`SELECT p.id, p.display_name, p.date_of_birth::text AS date_of_birth,
      p.lifecycle_status, p.version, p.updated_at, s.value AS sports_id_value,
      s.issued_at AS sports_id_issued_at, s.status AS sports_id_status
      FROM persons p LEFT JOIN sports_ids s ON s.person_id = p.id WHERE s.value = ${sportsId} LIMIT 1`);
  }

  findById(personId: Id<"Person">): Promise<PersonLookupResult> {
    return this.read(() => this.sql<PersonRow[]>`SELECT p.id, p.display_name, p.date_of_birth::text AS date_of_birth,
      p.lifecycle_status, p.version, p.updated_at, s.value AS sports_id_value,
      s.issued_at AS sports_id_issued_at, s.status AS sports_id_status
      FROM persons p LEFT JOIN sports_ids s ON s.person_id = p.id WHERE p.id = ${personId} LIMIT 1`);
  }

  async save(person: Person, expectedVersion: AggregateVersion): Promise<Result<Person, PersonPersistenceError>> {
    if (person.version !== expectedVersion + 1) return invalidState("Updated version must be exactly expected version plus one.");
    try {
      const rows = await this.sql<{ id: string }[]>`UPDATE persons
        SET lifecycle_status = ${person.lifecycleStatus}, version = ${person.version}, updated_at = ${person.updatedAt}
        WHERE id = ${person.id} AND version = ${expectedVersion} RETURNING id`;
      if (rows.length === 1) return { ok: true, value: person };
      const found = await this.sql<{ exists: boolean }[]>`SELECT EXISTS(SELECT 1 FROM persons WHERE id = ${person.id}) AS exists`;
      return { ok: false, error: { kind: found[0]?.exists === true ? "concurrency_conflict" : "not_found" } };
    } catch (error) { return { ok: false, error: { kind: "unavailable", detail: neutralDetail(error) } }; }
  }

  private async read(run: () => Promise<PersonRow[]>): Promise<PersonLookupResult> {
    try {
      const row = (await run())[0];
      if (row === undefined) return { kind: "not_found" };
      const person = toPerson(row);
      return person === null
        ? { kind: "invalid_persistence_state", detail: "Stored Person record violates persistence invariants." }
        : { kind: "found", person };
    } catch (error) { return { kind: "unavailable", detail: neutralDetail(error) }; }
  }
}

function mapCreateError(error: unknown): PersonPersistenceError {
  const info = pgErrorInfo(error);
  if (isUniqueViolation(info) && info !== null) return { kind: info.constraint.includes("persons_pkey") ? "duplicate_person_id" : "duplicate_sports_id" };
  return { kind: "unavailable", detail: neutralDetail(error) };
}

function invalidState(detail: string): Result<never, PersonPersistenceError> {
  return { ok: false, error: { kind: "invalid_persistence_state", detail } };
}
