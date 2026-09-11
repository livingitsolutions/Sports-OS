import { describe, it, expect } from "vitest";
import { InMemoryPersonRepository } from "@adapters/persistence/in-memory-person-repository";
import { createPerson } from "@domain/identity/person";
import type { Person } from "@domain/identity/identity.types";
import type { Id, ISODateString } from "@shared/kernel";

const NOW = "2026-01-01T00:00:00.000Z" as ISODateString;

function makePerson(personId: string, sportsIdValue: string): Person {
  const result = createPerson({
    personId: personId as Id<"Person">,
    sportsIdValue: sportsIdValue as Id<"SportsId">,
    displayName: "Test Person",
    dateOfBirth: null,
    now: NOW,
    personCreatedEventId: "evt-1",
    sportsIdIssuedEventId: "evt-2",
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value.person;
}

describe("InMemoryPersonRepository", () => {
  it("stores a new Person and looks it up by Sports ID", async () => {
    const repo = new InMemoryPersonRepository();
    const person = makePerson("p-1", "SID-1");

    const created = await repo.create(person);
    expect(created.ok).toBe(true);
    expect(repo.size).toBe(1);

    const found = await repo.findBySportsId("SID-1" as Id<"SportsId">);
    expect(found?.id).toBe("p-1");
  });

  it("rejects a duplicate Person ID without overwriting", async () => {
    const repo = new InMemoryPersonRepository();
    await repo.create(makePerson("p-1", "SID-1"));

    const result = await repo.create(makePerson("p-1", "SID-2"));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.kind).toBe("duplicate_person_id");
    expect(repo.size).toBe(1);
  });

  it("rejects a duplicate Sports ID", async () => {
    const repo = new InMemoryPersonRepository();
    await repo.create(makePerson("p-1", "SID-1"));

    const result = await repo.create(makePerson("p-2", "SID-1"));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.kind).toBe("duplicate_sports_id");
    expect(repo.size).toBe(1);
  });

  it("returns null when no Person has the given Sports ID", async () => {
    const repo = new InMemoryPersonRepository();
    const found = await repo.findBySportsId("missing" as Id<"SportsId">);
    expect(found).toBeNull();
  });
});
