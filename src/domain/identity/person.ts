import type { DomainError, Id, ISODateString } from "@shared/kernel";
import { Result } from "@shared/kernel";
import type { Person, SportsId } from "@domain/identity/identity.types";
import { issueSportsId } from "@domain/identity/sports-id";
import type {
  IdentityDomainEvent,
  PersonCreated,
  SportsIdIssued,
} from "@domain/identity/identity.events";

const MAX_DISPLAY_NAME = 200;

/**
 * Everything `createPerson` needs, supplied as plain values. The domain never
 * generates identifiers or reads a clock itself (ADR-016): the application
 * generates the Person ID, the Sports ID value and event IDs, and reads the
 * timestamp, then hands them in.
 */
export interface NewPersonInput {
  readonly personId: Id<"Person">;
  readonly sportsIdValue: Id<"SportsId">;
  readonly displayName: string;
  /** Private identity data (see Person.dateOfBirth). Optional. */
  readonly dateOfBirth?: string | null;
  readonly now: ISODateString;
  readonly personCreatedEventId: string;
  readonly sportsIdIssuedEventId: string;
}

export interface CreatedPerson {
  readonly person: Person;
  readonly sportsId: SportsId;
  readonly events: readonly IdentityDomainEvent[];
}

/**
 * Creates a valid, active Person and issues exactly one Sports ID in the same
 * logical operation. Returns the Person together with the facts it produced.
 *
 * Enforced invariants:
 *  - identity data is valid (non-empty display name, real past date of birth
 *    if given);
 *  - a new active Person always has exactly one Sports ID;
 *  - the Person is platform-global (there is no tenant/org input to attach);
 *  - the initial lifecycle status is "active".
 *
 * Guardian relationships are deliberately NOT modelled here: they are a separate
 * relationship concept (Auth context) and must not couple to Person identity.
 *
 * Expected validation failures are returned as a typed `Result`, never thrown.
 */
export function createPerson(
  input: NewPersonInput,
): Result<CreatedPerson, DomainError> {
  const displayName = input.displayName.trim();
  if (displayName.length === 0) {
    return Result.fail(err("invalid_display_name", "Display name is required."));
  }
  if (displayName.length > MAX_DISPLAY_NAME) {
    return Result.fail(
      err("invalid_display_name", `Display name must be at most ${MAX_DISPLAY_NAME} characters.`),
    );
  }

  const dateOfBirth = input.dateOfBirth ?? null;
  if (dateOfBirth !== null) {
    if (!isCalendarDate(dateOfBirth)) {
      return Result.fail(err("invalid_date_of_birth", "Date of birth must be a valid YYYY-MM-DD date."));
    }
    if (dateOfBirth > input.now.slice(0, 10)) {
      return Result.fail(err("invalid_date_of_birth", "Date of birth cannot be in the future."));
    }
  }

  if (input.sportsIdValue.trim().length === 0) {
    return Result.fail(err("invalid_sports_id", "A Sports ID value is required to create an active Person."));
  }

  const sportsId = issueSportsId(input.sportsIdValue, input.now);
  const person: Person = {
    id: input.personId,
    sportsId,
    displayName,
    dateOfBirth,
    lifecycleStatus: "active",
  };

  const personCreated: PersonCreated = {
    type: "identity.person_created",
    eventId: input.personCreatedEventId,
    occurredAt: input.now,
    aggregateId: input.personId,
    aggregateType: "Person",
    personId: input.personId,
  };
  const sportsIdIssued: SportsIdIssued = {
    type: "identity.sports_id_issued",
    eventId: input.sportsIdIssuedEventId,
    occurredAt: input.now,
    aggregateId: input.personId,
    aggregateType: "Person",
    personId: input.personId,
    sportsId: input.sportsIdValue,
  };

  return Result.ok({ person, sportsId, events: [personCreated, sportsIdIssued] });
}

/**
 * Representative "normal" Person mutation. It changes mutable identity data and
 * deliberately preserves the Sports ID untouched: there is no domain operation
 * that replaces a Person's Sports ID, which keeps the identifier permanent.
 */
export function renamePerson(
  person: Person,
  newDisplayName: string,
): Result<Person, DomainError> {
  const displayName = newDisplayName.trim();
  if (displayName.length === 0) {
    return Result.fail(err("invalid_display_name", "Display name is required."));
  }
  if (displayName.length > MAX_DISPLAY_NAME) {
    return Result.fail(
      err("invalid_display_name", `Display name must be at most ${MAX_DISPLAY_NAME} characters.`),
    );
  }
  return Result.ok({ ...person, displayName });
}

function err(code: string, message: string): DomainError {
  return { code, message };
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}
