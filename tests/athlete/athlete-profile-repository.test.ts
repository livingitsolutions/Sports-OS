import { describe, it, expect } from "vitest";
import { InMemoryAthleteProfileRepository } from "@adapters/persistence/in-memory-athlete-profile-repository";
import type {
  AthleteProfile,
  AthleteSportParticipation,
} from "@domain/athlete/athlete.types";
import type { Id, ISODateString } from "@shared/kernel";

const NOW = "2026-03-01T00:00:00.000Z" as ISODateString;

function profile(id: string, personId: string): AthleteProfile {
  return {
    id: id as Id<"AthleteProfile">,
    personId: personId as Id<"Person">,
    status: "active",
    createdAt: NOW,
  };
}

function participation(
  id: string,
  profileId: string,
  sportId: string,
): AthleteSportParticipation {
  return {
    id: id as Id<"AthleteSportParticipation">,
    athleteProfileId: profileId as Id<"AthleteProfile">,
    sportId: sportId as Id<"Sport">,
    status: "active",
    startedAt: NOW,
    endedAt: null,
  };
}

describe("InMemoryAthleteProfileRepository", () => {
  it("stores a new profile and looks it up by id and person", async () => {
    const repo = new InMemoryAthleteProfileRepository();
    const created = await repo.create(profile("a-1", "p-1"));
    expect(created.ok).toBe(true);
    expect(repo.size).toBe(1);
    expect((await repo.findById("a-1" as Id<"AthleteProfile">))?.id).toBe("a-1");
    expect((await repo.findByPersonId("p-1" as Id<"Person">))?.id).toBe("a-1");
  });

  it("rejects a duplicate AthleteProfile ID without overwriting", async () => {
    const repo = new InMemoryAthleteProfileRepository();
    await repo.create(profile("a-1", "p-1"));

    const result = await repo.create(profile("a-1", "p-2"));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.kind).toBe("duplicate_athlete_profile_id");
    expect(repo.size).toBe(1);
    // The original person mapping is intact; the second person got nothing.
    expect(await repo.findByPersonId("p-2" as Id<"Person">)).toBeNull();
  });

  it("rejects a second profile for the same Person", async () => {
    const repo = new InMemoryAthleteProfileRepository();
    await repo.create(profile("a-1", "p-1"));

    const result = await repo.create(profile("a-2", "p-1"));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.kind).toBe("person_already_has_profile");
    expect(repo.size).toBe(1);
    expect(await repo.findById("a-2" as Id<"AthleteProfile">)).toBeNull();
  });

  it("stores participations and rejects a duplicate active sport", async () => {
    const repo = new InMemoryAthleteProfileRepository();
    await repo.create(profile("a-1", "p-1"));

    const first = await repo.addParticipation(participation("part-1", "a-1", "s-1"));
    expect(first.ok).toBe(true);

    const dup = await repo.addParticipation(participation("part-2", "a-1", "s-1"));
    expect(dup.ok).toBe(false);
    if (dup.ok) throw new Error("expected failure");
    expect(dup.error.kind).toBe("already_participating");

    const list = await repo.listParticipations("a-1" as Id<"AthleteProfile">);
    expect(list).toHaveLength(1);
  });

  it("rejects a participation for a missing profile", async () => {
    const repo = new InMemoryAthleteProfileRepository();
    const result = await repo.addParticipation(participation("part-1", "ghost", "s-1"));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.kind).toBe("athlete_profile_not_found");
  });
});
