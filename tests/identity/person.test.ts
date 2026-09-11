import { describe, it, expect } from "vitest";
import { createPerson, renamePerson } from "@domain/identity/person";
import type { NewPersonInput } from "@domain/identity/person";
import type { Id, ISODateString } from "@shared/kernel";

const NOW = "2026-01-01T00:00:00.000Z" as ISODateString;

function input(overrides: Partial<NewPersonInput> = {}): NewPersonInput {
  return {
    personId: "person-1" as Id<"Person">,
    sportsIdValue: "SID1-ABCDEFGHJKMN" as Id<"SportsId">,
    displayName: "  Maria Santos  ",
    dateOfBirth: "2000-05-01",
    now: NOW,
    personCreatedEventId: "evt-created-1",
    sportsIdIssuedEventId: "evt-issued-1",
    ...overrides,
  };
}

describe("createPerson", () => {
  it("creates an active, platform-global Person with one active Sports ID", () => {
    const result = createPerson(input());
    if (!result.ok) throw new Error(result.error.message);

    const { person, sportsId } = result.value;
    expect(person.lifecycleStatus).toBe("active");
    expect(person.displayName).toBe("Maria Santos");
    expect(person.sportsId).not.toBeNull();
    expect(person.sportsId?.status).toBe("active");
    expect(person.sportsId?.value).toBe("SID1-ABCDEFGHJKMN");
    expect(person.sportsId?.issuedAt).toBe(NOW);
    expect(sportsId.value).toBe("SID1-ABCDEFGHJKMN");
  });

  it("keeps the Person ID and Sports ID as distinct identifiers", () => {
    const result = createPerson(input());
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.person.id).toBe("person-1");
    expect(result.value.sportsId.value).toBe("SID1-ABCDEFGHJKMN");
    expect(String(result.value.person.id)).not.toBe(String(result.value.sportsId.value));
  });

  it("produces a PersonCreated and a SportsIdIssued event with matching identifiers", () => {
    const result = createPerson(input());
    if (!result.ok) throw new Error(result.error.message);

    const { events } = result.value;
    expect(events).toHaveLength(2);

    const created = events.find((e) => e.type === "identity.person_created");
    const issued = events.find((e) => e.type === "identity.sports_id_issued");
    expect(created).toBeDefined();
    expect(issued).toBeDefined();
    expect(created?.personId).toBe("person-1");
    expect(created?.occurredAt).toBe(NOW);
    expect(issued?.personId).toBe("person-1");
    if (issued?.type === "identity.sports_id_issued") {
      expect(issued.sportsId).toBe("SID1-ABCDEFGHJKMN");
    }
  });

  it("never leaks sensitive personal data into events", () => {
    const result = createPerson(input({ displayName: "Juan dela Cruz", dateOfBirth: "1998-03-12" }));
    if (!result.ok) throw new Error(result.error.message);
    const serialized = JSON.stringify(result.value.events);
    expect(serialized).not.toContain("Juan");
    expect(serialized).not.toContain("1998-03-12");
  });

  it("rejects a blank display name", () => {
    const result = createPerson(input({ displayName: "   " }));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("invalid_display_name");
  });

  it("rejects a future date of birth", () => {
    const result = createPerson(input({ dateOfBirth: "2999-01-01" }));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("invalid_date_of_birth");
  });

  it("rejects an impossible calendar date", () => {
    const result = createPerson(input({ dateOfBirth: "2001-02-30" }));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("invalid_date_of_birth");
  });
});

describe("renamePerson", () => {
  it("changes the display name but never replaces the Sports ID", () => {
    const created = createPerson(input());
    if (!created.ok) throw new Error(created.error.message);

    const renamed = renamePerson(created.value.person, "Maria S. Reyes");
    if (!renamed.ok) throw new Error(renamed.error.message);

    expect(renamed.value.displayName).toBe("Maria S. Reyes");
    expect(renamed.value.sportsId).toEqual(created.value.person.sportsId);
  });

  it("rejects a blank display name", () => {
    const created = createPerson(input());
    if (!created.ok) throw new Error(created.error.message);
    const renamed = renamePerson(created.value.person, "  ");
    expect(renamed.ok).toBe(false);
  });
});
