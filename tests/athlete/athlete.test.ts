import { describe, it, expect } from "vitest";
import { createAthleteProfile } from "@domain/athlete/athlete-profile";
import { addAthleteSport } from "@domain/athlete/athlete-sport";
import type { Id, ISODateString } from "@shared/kernel";

const NOW = "2026-03-01T00:00:00.000Z" as ISODateString;
const PERSON = "person-1" as Id<"Person">;
const PROFILE = "athlete-1" as Id<"AthleteProfile">;
const SPORT = "sport-basketball" as Id<"Sport">;

describe("createAthleteProfile", () => {
  it("creates an active profile linked to exactly one Person", () => {
    const result = createAthleteProfile({
      athleteProfileId: PROFILE,
      personId: PERSON,
      now: NOW,
      createdEventId: "evt-1",
    });
    if (!result.ok) throw new Error(result.error.message);

    const { profile } = result.value;
    expect(profile.id).toBe(PROFILE);
    expect(profile.personId).toBe(PERSON);
    expect(profile.status).toBe("active");
    expect(profile.createdAt).toBe(NOW);
  });

  it("does not duplicate any Person identity data", () => {
    const result = createAthleteProfile({
      athleteProfileId: PROFILE,
      personId: PERSON,
      now: NOW,
      createdEventId: "evt-1",
    });
    if (!result.ok) throw new Error(result.error.message);

    const keys = Object.keys(result.value.profile);
    expect(keys).toEqual(["id", "personId", "status", "createdAt"]);
    expect(keys).not.toContain("displayName");
    expect(keys).not.toContain("dateOfBirth");
    expect(keys).not.toContain("sportsId");
  });

  it("emits an AthleteProfileCreated event with only identifiers, no personal data", () => {
    const result = createAthleteProfile({
      athleteProfileId: PROFILE,
      personId: PERSON,
      now: NOW,
      createdEventId: "evt-1",
    });
    if (!result.ok) throw new Error(result.error.message);

    expect(result.value.events).toHaveLength(1);
    const [event] = result.value.events;
    expect(event?.type).toBe("athlete.profile_created");
    const serialized = JSON.stringify(result.value.events);
    expect(serialized).not.toContain("dateOfBirth");
    expect(serialized).not.toContain("displayName");
    expect(serialized).not.toContain("SID");
  });

  it("rejects a blank Person reference", () => {
    const result = createAthleteProfile({
      athleteProfileId: PROFILE,
      personId: "   " as Id<"Person">,
      now: NOW,
      createdEventId: "evt-1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("invalid_person");
  });
});

describe("addAthleteSport", () => {
  it("builds an active participation that references the Sport by ID only", () => {
    const result = addAthleteSport({
      participationId: "part-1" as Id<"AthleteSportParticipation">,
      athleteProfileId: PROFILE,
      sportId: SPORT,
      now: NOW,
      addedEventId: "evt-1",
    });
    if (!result.ok) throw new Error(result.error.message);

    const { participation } = result.value;
    expect(participation.athleteProfileId).toBe(PROFILE);
    expect(participation.sportId).toBe(SPORT);
    expect(participation.status).toBe("active");
    expect(participation.startedAt).toBe(NOW);
    expect(participation.endedAt).toBeNull();
    // No tournament/event/result/ranking data is present.
    const keys = Object.keys(participation);
    expect(keys).toEqual([
      "id",
      "athleteProfileId",
      "sportId",
      "status",
      "startedAt",
      "endedAt",
    ]);
  });

  it("emits an AthleteSportAdded event carrying only identifiers", () => {
    const result = addAthleteSport({
      participationId: "part-1" as Id<"AthleteSportParticipation">,
      athleteProfileId: PROFILE,
      sportId: SPORT,
      now: NOW,
      addedEventId: "evt-1",
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.events).toHaveLength(1);
    expect(result.value.events[0]?.type).toBe("athlete.sport_added");
  });

  it("rejects a blank Sport reference", () => {
    const result = addAthleteSport({
      participationId: "part-1" as Id<"AthleteSportParticipation">,
      athleteProfileId: PROFILE,
      sportId: "  " as Id<"Sport">,
      now: NOW,
      addedEventId: "evt-1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("invalid_sport");
  });
});
