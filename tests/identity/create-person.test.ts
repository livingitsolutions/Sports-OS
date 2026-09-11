import { describe, it, expect } from "vitest";
import { CreatePerson } from "@app/use-cases/create-person";
import type { CreatePersonDeps } from "@app/use-cases/create-person";
import { FakeClock } from "@adapters/clock/fake-clock";
import { FakeIdGenerator } from "@adapters/id/fake-id-generator";
import { FakeSportsIdGenerator } from "@adapters/id/fake-sports-id-generator";
import { InMemoryPersonRepository } from "@adapters/persistence/in-memory-person-repository";
import { InMemoryEventPublisher } from "@adapters/events/in-memory-event-publisher";
import { createPerson } from "@domain/identity/person";
import type { DomainEvent } from "@app/contracts/events";
import type { Id, ISODateString } from "@shared/kernel";

const NOW = "2026-01-01T00:00:00.000Z" as ISODateString;

function setup(overrides: Partial<CreatePersonDeps> = {}) {
  const clock = new FakeClock();
  const idGenerator = new FakeIdGenerator();
  const sportsIdGenerator = new FakeSportsIdGenerator();
  const personRepository = new InMemoryPersonRepository();
  const domainEvents = new InMemoryEventPublisher<DomainEvent>();
  const useCase = new CreatePerson({
    clock,
    idGenerator,
    sportsIdGenerator,
    personRepository,
    domainEvents,
    ...overrides,
  });
  return { clock, idGenerator, sportsIdGenerator, personRepository, domainEvents, useCase };
}

async function seed(repo: InMemoryPersonRepository, personId: string, sportsIdValue: string) {
  const built = createPerson({
    personId: personId as Id<"Person">,
    sportsIdValue: sportsIdValue as Id<"SportsId">,
    displayName: "Seed",
    dateOfBirth: null,
    now: NOW,
    personCreatedEventId: "seed-1",
    sportsIdIssuedEventId: "seed-2",
  });
  if (!built.ok) throw new Error(built.error.message);
  await repo.create(built.value.person);
}

describe("CreatePerson", () => {
  it("creates a Person, issues one Sports ID, persists it, and publishes events", async () => {
    const { useCase, personRepository, domainEvents } = setup();

    const result = await useCase.execute({ displayName: "Maria Santos" });
    if (!result.ok) throw new Error(result.error.message);

    expect(result.value.person.id).toBe("test-Person-1");
    expect(result.value.sportsId.value).toBe("SID-TEST-1");
    expect(result.value.person.sportsId?.value).toBe("SID-TEST-1");
    expect(result.value.person.sportsId?.issuedAt).toBe(NOW);
    expect(personRepository.size).toBe(1);
    expect(domainEvents.events).toHaveLength(2);
    expect(domainEvents.events).toEqual(result.value.events);
  });

  it("uses deterministic IDs and timestamp under the test composition", async () => {
    const { useCase } = setup();
    const result = await useCase.execute({ displayName: "Ana" });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.person.id).toBe("test-Person-1");
    expect(result.value.sportsId.value).toBe("SID-TEST-1");
    expect(result.value.person.sportsId?.issuedAt).toBe(NOW);
  });

  it("publishes nothing and stores nothing when input is invalid", async () => {
    const { useCase, personRepository, domainEvents } = setup();
    const result = await useCase.execute({ displayName: "   " });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.kind).toBe("invalid_input");
    expect(personRepository.size).toBe(0);
    expect(domainEvents.events).toHaveLength(0);
  });

  it("retries past a Sports ID collision and never overwrites the existing holder", async () => {
    const { useCase, personRepository } = setup();
    await seed(personRepository, "seed-person", "SID-TEST-1");

    const result = await useCase.execute({ displayName: "Bea" });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.sportsId.value).toBe("SID-TEST-2");
    expect(personRepository.size).toBe(2);
  });

  it("returns a typed collision error when bounded retries are exhausted", async () => {
    const { useCase, sportsIdGenerator, personRepository, domainEvents } = setup({
      maxSportsIdAttempts: 2,
    });
    await seed(personRepository, "holder-a", "DUP-A");
    await seed(personRepository, "holder-b", "DUP-B");
    sportsIdGenerator.enqueue("DUP-A", "DUP-B");

    const result = await useCase.execute({ displayName: "Carlos" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.kind).toBe("sports_id_collision");
    expect(personRepository.size).toBe(2);
    expect(domainEvents.events).toHaveLength(0);
  });

  it("surfaces a duplicate Person ID from persistence without publishing events", async () => {
    const { useCase, personRepository, domainEvents } = setup();
    await seed(personRepository, "test-Person-1", "OTHER-SID");

    const result = await useCase.execute({ displayName: "Diego" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.kind).toBe("duplicate_person_id");
    expect(domainEvents.events).toHaveLength(0);
  });
});
