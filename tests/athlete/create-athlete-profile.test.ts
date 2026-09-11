import { describe, it, expect } from "vitest";
import { CreateAthleteProfile } from "@app/use-cases/create-athlete-profile";
import { FakeClock } from "@adapters/clock/fake-clock";
import { FakeIdGenerator } from "@adapters/id/fake-id-generator";
import { InMemoryPersonRepository } from "@adapters/persistence/in-memory-person-repository";
import { InMemoryAthleteProfileRepository } from "@adapters/persistence/in-memory-athlete-profile-repository";
import { InMemoryEventPublisher } from "@adapters/events/in-memory-event-publisher";
import { createPerson } from "@domain/identity/person";
import type { AthleteProfile } from "@domain/athlete/athlete.types";
import type { DomainEvent } from "@app/contracts/events";
import type { Id, ISODateString } from "@shared/kernel";

const NOW = "2026-03-01T00:00:00.000Z" as ISODateString;

function setup() {
  const clock = new FakeClock(NOW);
  const idGenerator = new FakeIdGenerator();
  const personRepository = new InMemoryPersonRepository();
  const athleteProfileRepository = new InMemoryAthleteProfileRepository();
  const domainEvents = new InMemoryEventPublisher<DomainEvent>();
  const useCase = new CreateAthleteProfile({
    clock,
    idGenerator,
    personRepository,
    athleteProfileRepository,
    domainEvents,
  });
  return { personRepository, athleteProfileRepository, domainEvents, useCase };
}

async function seedPerson(repo: InMemoryPersonRepository, personId: string) {
  const built = createPerson({
    personId: personId as Id<"Person">,
    sportsIdValue: `SID-${personId}` as Id<"SportsId">,
    displayName: "Seed",
    dateOfBirth: null,
    now: NOW,
    personCreatedEventId: "seed-1",
    sportsIdIssuedEventId: "seed-2",
  });
  if (!built.ok) throw new Error(built.error.message);
  await repo.create(built.value.person);
}

function seedProfile(
  repo: InMemoryAthleteProfileRepository,
  id: string,
  personId: string,
) {
  const profile: AthleteProfile = {
    id: id as Id<"AthleteProfile">,
    personId: personId as Id<"Person">,
    status: "active",
    createdAt: NOW,
  };
  return repo.create(profile);
}

describe("CreateAthleteProfile", () => {
  it("creates a profile for an existing Person, persists it, and publishes one event", async () => {
    const { personRepository, athleteProfileRepository, domainEvents, useCase } = setup();
    await seedPerson(personRepository, "p-1");

    const result = await useCase.execute({ personId: "p-1" });
    if (!result.ok) throw new Error(result.error.message);

    expect(result.value.profile.id).toBe("test-AthleteProfile-1");
    expect(result.value.profile.personId).toBe("p-1");
    expect(result.value.profile.status).toBe("active");
    expect(result.value.profile.createdAt).toBe(NOW);
    expect(athleteProfileRepository.size).toBe(1);
    expect(domainEvents.events).toHaveLength(1);
    expect(domainEvents.events).toEqual(result.value.events);
  });

  it("requires the Person to exist", async () => {
    const { athleteProfileRepository, domainEvents, useCase } = setup();

    const result = await useCase.execute({ personId: "ghost" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.kind).toBe("person_not_found");
    expect(athleteProfileRepository.size).toBe(0);
    expect(domainEvents.events).toHaveLength(0);
  });

  it("rejects a second AthleteProfile for the same Person", async () => {
    const { personRepository, athleteProfileRepository, domainEvents, useCase } = setup();
    await seedPerson(personRepository, "p-1");
    await seedProfile(athleteProfileRepository, "existing", "p-1");

    const result = await useCase.execute({ personId: "p-1" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.kind).toBe("athlete_profile_already_exists");
    expect(athleteProfileRepository.size).toBe(1);
    expect(domainEvents.events).toHaveLength(0);
  });

  it("does not overwrite when the generated AthleteProfile ID already exists", async () => {
    const { personRepository, athleteProfileRepository, domainEvents, useCase } = setup();
    await seedPerson(personRepository, "p-1");
    // Occupy the id the deterministic generator will mint, under another person.
    await seedProfile(athleteProfileRepository, "test-AthleteProfile-1", "p-other");

    const result = await useCase.execute({ personId: "p-1" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.kind).toBe("duplicate_athlete_profile_id");
    expect(athleteProfileRepository.size).toBe(1);
    expect(
      (await athleteProfileRepository.findById(
        "test-AthleteProfile-1" as Id<"AthleteProfile">,
      ))?.personId,
    ).toBe("p-other");
    expect(domainEvents.events).toHaveLength(0);
  });

  it("uses deterministic IDs and timestamp under the test composition", async () => {
    const { personRepository, useCase } = setup();
    await seedPerson(personRepository, "p-1");

    const result = await useCase.execute({ personId: "p-1" });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.profile.id).toBe("test-AthleteProfile-1");
    expect(result.value.profile.createdAt).toBe(NOW);
  });
});
