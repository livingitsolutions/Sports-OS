import { describe, expect, it } from "vitest";
import { DeactivatePerson } from "@app/use-cases/deactivate-person";
import { FakeClock } from "@adapters/clock/fake-clock";
import { FakeIdGenerator } from "@adapters/id/fake-id-generator";
import { InMemoryEventPublisher } from "@adapters/events/in-memory-event-publisher";
import { InMemoryPersonRepository } from "@adapters/persistence/in-memory-person-repository";
import { createPerson } from "@domain/identity/person";
import type { DomainEvent } from "@domain/aggregate";
import type { Id, ISODateString } from "@shared/kernel";

const NOW = "2026-09-11T12:00:00.000Z" as ISODateString;

async function setup() {
  const repository = new InMemoryPersonRepository();
  const made = createPerson({ personId: "p-1" as Id<"Person">, sportsIdValue: "SID-1" as Id<"SportsId">,
    displayName: "Test", dateOfBirth: null, now: NOW, personCreatedEventId: "e1", sportsIdIssuedEventId: "e2" });
  if (!made.ok) throw new Error("fixture failed");
  await repository.create(made.value.person);
  const events = new InMemoryEventPublisher<DomainEvent>();
  const useCase = new DeactivatePerson({ clock: new FakeClock(NOW), idGenerator: new FakeIdGenerator(), personRepository: repository, domainEvents: events });
  return { repository, events, useCase };
}

describe("DeactivatePerson", () => {
  it("advances N to N+1, persists it, then publishes the domain-produced event", async () => {
    const { useCase, repository, events } = await setup();
    const result = await useCase.execute({ personId: "p-1" });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.person.version).toBe(2);
    expect(result.value.person.lifecycleStatus).toBe("deactivated");
    expect(result.value.event.aggregateVersion).toBe(2);
    expect(events.events).toEqual([result.value.event]);
    const stored = await repository.findById("p-1" as Id<"Person">);
    expect(stored.kind === "found" && stored.person.version).toBe(2);
  });

  it("publishes nothing when the transition is invalid", async () => {
    const { useCase, events } = await setup();
    await useCase.execute({ personId: "p-1" });
    events.clear();
    const result = await useCase.execute({ personId: "p-1" });
    expect(result.ok).toBe(false);
    expect(events.events).toHaveLength(0);
  });

  it("returns typed not_found without publishing", async () => {
    const { useCase, events } = await setup();
    const result = await useCase.execute({ personId: "missing" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.kind).toBe("person_not_found");
    expect(events.events).toHaveLength(0);
  });

  it("publishes nothing when the expected-version save loses a race", async () => {
    const { useCase, repository, events } = await setup();
    repository.save = async () => ({ ok: false, error: { kind: "concurrency_conflict" } });
    const result = await useCase.execute({ personId: "p-1" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.kind).toBe("concurrency_conflict");
    expect(events.events).toHaveLength(0);
  });

  it("publishes nothing when persistence is unavailable", async () => {
    const { useCase, repository, events } = await setup();
    repository.save = async () => ({ ok: false, error: { kind: "unavailable" } });
    const result = await useCase.execute({ personId: "p-1" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.kind).toBe("persistence_unavailable");
    expect(events.events).toHaveLength(0);
  });
});
