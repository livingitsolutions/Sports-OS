import { describe, it, expect } from "vitest";
import { AddAthleteSport } from "@app/use-cases/add-athlete-sport";
import { FakeClock } from "@adapters/clock/fake-clock";
import { FakeIdGenerator } from "@adapters/id/fake-id-generator";
import { InMemoryAthleteProfileRepository } from "@adapters/persistence/in-memory-athlete-profile-repository";
import { InMemorySportDirectory } from "@adapters/sports/in-memory-sport-directory";
import { InMemoryEventPublisher } from "@adapters/events/in-memory-event-publisher";
import type { AthleteProfile } from "@domain/athlete/athlete.types";
import type { DomainEvent } from "@app/contracts/events";
import type { Id, ISODateString } from "@shared/kernel";

const NOW = "2026-03-01T00:00:00.000Z" as ISODateString;

function setup(knownSports: string[] = ["basketball", "swimming"]) {
  const clock = new FakeClock(NOW);
  const idGenerator = new FakeIdGenerator();
  const athleteProfileRepository = new InMemoryAthleteProfileRepository();
  const sportDirectory = new InMemorySportDirectory(
    knownSports as Id<"Sport">[],
  );
  const domainEvents = new InMemoryEventPublisher<DomainEvent>();
  const useCase = new AddAthleteSport({
    clock,
    idGenerator,
    athleteProfileRepository,
    sportDirectory,
    domainEvents,
  });
  return { athleteProfileRepository, sportDirectory, domainEvents, useCase };
}

async function seedProfile(
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
  const result = await repo.create(profile);
  if (!result.ok) throw new Error(result.error.kind);
}

describe("AddAthleteSport", () => {
  it("lets one AthleteProfile participate in multiple different sports", async () => {
    const { athleteProfileRepository, domainEvents, useCase } = setup();
    await seedProfile(athleteProfileRepository, "a-1", "p-1");

    const first = await useCase.execute({ athleteProfileId: "a-1", sportId: "basketball" });
    const second = await useCase.execute({ athleteProfileId: "a-1", sportId: "swimming" });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);

    const list = await athleteProfileRepository.listParticipations(
      "a-1" as Id<"AthleteProfile">,
    );
    expect(list).toHaveLength(2);
    expect(list.map((p) => p.sportId).sort()).toEqual(["basketball", "swimming"]);
    expect(domainEvents.events).toHaveLength(2);
  });

  it("rejects adding the same sport twice while active", async () => {
    const { athleteProfileRepository, domainEvents, useCase } = setup();
    await seedProfile(athleteProfileRepository, "a-1", "p-1");

    const first = await useCase.execute({ athleteProfileId: "a-1", sportId: "basketball" });
    expect(first.ok).toBe(true);

    const dup = await useCase.execute({ athleteProfileId: "a-1", sportId: "basketball" });
    expect(dup.ok).toBe(false);
    if (dup.ok) throw new Error("expected failure");
    expect(dup.error.kind).toBe("already_participating");

    const list = await athleteProfileRepository.listParticipations(
      "a-1" as Id<"AthleteProfile">,
    );
    expect(list).toHaveLength(1);
    // Only the successful add published an event.
    expect(domainEvents.events).toHaveLength(1);
  });

  it("lets different athletes participate in the same sport", async () => {
    const { athleteProfileRepository, useCase } = setup();
    await seedProfile(athleteProfileRepository, "a-1", "p-1");
    await seedProfile(athleteProfileRepository, "a-2", "p-2");

    const one = await useCase.execute({ athleteProfileId: "a-1", sportId: "basketball" });
    const two = await useCase.execute({ athleteProfileId: "a-2", sportId: "basketball" });
    expect(one.ok).toBe(true);
    expect(two.ok).toBe(true);
  });

  it("validates that the Sport exists", async () => {
    const { athleteProfileRepository, domainEvents, useCase } = setup();
    await seedProfile(athleteProfileRepository, "a-1", "p-1");

    const result = await useCase.execute({ athleteProfileId: "a-1", sportId: "chess" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.kind).toBe("sport_not_found");
    expect(domainEvents.events).toHaveLength(0);
  });

  it("requires the AthleteProfile to exist", async () => {
    const { domainEvents, useCase } = setup();

    const result = await useCase.execute({ athleteProfileId: "ghost", sportId: "basketball" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.kind).toBe("athlete_profile_not_found");
    expect(domainEvents.events).toHaveLength(0);
  });

  it("records participation only, with no competition/result data", async () => {
    const { athleteProfileRepository, useCase } = setup();
    await seedProfile(athleteProfileRepository, "a-1", "p-1");

    const result = await useCase.execute({ athleteProfileId: "a-1", sportId: "basketball" });
    if (!result.ok) throw new Error(result.error.message);
    const keys = Object.keys(result.value.participation);
    expect(keys).toEqual([
      "id",
      "athleteProfileId",
      "sportId",
      "status",
      "startedAt",
      "endedAt",
    ]);
  });
});
