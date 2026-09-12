import { describe, expect, it } from "vitest";
import {
  CreateAthleteCompetitionEntry,
  CreateTeamCompetitionEntry,
  WithdrawCompetitionEntry,
} from "@app/use-cases/manage-competition-entries";
import type { AuthorizeOrganizationPermission } from "@app/use-cases/authorize-organization-permission";
import {
  FakeClock,
  FakeIdGenerator,
  InMemoryAthleteProfileRepository,
  InMemoryCompetitionEntryRepository,
  InMemoryCompetitionRepository,
  InMemoryDivisionRepository,
  InMemoryEventPublisher,
  InMemoryEventRepository,
  InMemoryTeamRepository,
} from "@adapters";
import {
  createCompetitionEntry,
  withdrawCompetitionEntry,
} from "@domain/competition/competition-entry";
import type {
  AthleteProfile,
  AthleteSportParticipation,
} from "@domain/athlete/athlete.types";
import type {
  Competition,
  Division,
  Event,
} from "@domain/competition/competition.types";
import type { Team } from "@domain/team/team.types";
import type { Id, ISODateString } from "@shared/kernel";
const NOW = "2026-09-12T10:00:00.000Z" as ISODateString,
  id = <T extends string>(x: string) => x as Id<T>;
const meta = { now: NOW, domainEventId: "domain" };
describe("CompetitionEntry aggregate", () => {
  it("creates athlete and team identities active at v1 and withdraws immutably at v2", () => {
    for (const entrant of [
      {
        entrantType: "athlete" as const,
        athleteProfileId: id<"AthleteProfile">("athlete"),
      },
      { entrantType: "team" as const, teamId: id<"Team">("team") },
    ]) {
      const made = createCompetitionEntry({
        id: id<"CompetitionEntry">(`entry-${entrant.entrantType}`),
        competitionId: id<"Competition">("competition"),
        ...entrant,
        ...meta,
      });
      expect(made).toMatchObject({
        ok: true,
        value: { entry: { status: "active", version: 1 } },
      });
      if (!made.ok) throw Error();
      const old = made.value.entry;
      const withdrawn = withdrawCompetitionEntry(old, meta);
      expect(withdrawn).toMatchObject({
        ok: true,
        value: { entry: { status: "withdrawn", version: 2 } },
      });
      expect(old.status).toBe("active");
      if (!withdrawn.ok) throw Error();
      expect(
        withdrawCompetitionEntry(withdrawn.value.entry, meta),
      ).toMatchObject({ ok: false, error: { code: "already_withdrawn" } });
    }
  });
  it("rejects every mismatched or non-exclusive identity", () => {
    for (const x of [
      { entrantType: "athlete" as const },
      {
        entrantType: "athlete" as const,
        athleteProfileId: id<"AthleteProfile">("a"),
        teamId: id<"Team">("t"),
      },
      {
        entrantType: "team" as const,
        athleteProfileId: id<"AthleteProfile">("a"),
      },
    ])
      expect(
        createCompetitionEntry({
          id: id<"CompetitionEntry">("entry"),
          competitionId: id<"Competition">("competition"),
          ...x,
          ...meta,
        }),
      ).toMatchObject({
        ok: false,
        error: { code: "invalid_entrant_identity" },
      });
  });
});
type Options = {
  allowed?: boolean;
  competitionStatus?: Competition["status"];
  division?: "none" | "wrong" | "inactive";
  teamStatus?: Team["status"];
  teamSport?: string;
  teamOrg?: string;
  participation?: "active" | "wrong" | "ended" | "none";
};
async function setup(o: Options = {}) {
  const eventRepository = new InMemoryEventRepository(),
    competitionRepository = new InMemoryCompetitionRepository(),
    divisionRepository = new InMemoryDivisionRepository(),
    competitionEntryRepository = new InMemoryCompetitionEntryRepository(),
    athleteProfileRepository = new InMemoryAthleteProfileRepository(),
    teamRepository = new InMemoryTeamRepository(),
    domainEvents = new InMemoryEventPublisher();
  const event: Event = {
    id: id<"Event">("event"),
    organizationId: id<"Organization">("organizer-a"),
    name: "Games",
    key: "games",
    status: "active",
    startsAt: null,
    endsAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1 as Event["version"],
  };
  const competition: Competition = {
    id: id<"Competition">("competition"),
    eventId: event.id,
    sportId: id<"Sport">("basketball"),
    name: "Open",
    key: "open",
    status: o.competitionStatus ?? "draft",
    createdAt: NOW,
    updatedAt: NOW,
    version: 1 as Competition["version"],
  };
  const division: Division = {
    id: id<"Division">("division"),
    competitionId: id<"Competition">(
      o.division === "wrong" ? "other" : competition.id,
    ),
    name: "U18",
    key: "u18",
    status: o.division === "inactive" ? "inactive" : "active",
    createdAt: NOW,
    updatedAt: NOW,
    version: 1 as Division["version"],
  };
  const athlete: AthleteProfile = {
    id: id<"AthleteProfile">("athlete"),
    personId: id<"Person">("person"),
    status: "active",
    createdAt: NOW,
    version: 1 as AthleteProfile["version"],
  };
  const team: Team = {
    id: id<"Team">("team"),
    organizationId: id<"Organization">(o.teamOrg ?? "entrant-b"),
    sportId: id<"Sport">(o.teamSport ?? "basketball"),
    name: "Visitors",
    key: "visitors",
    status: o.teamStatus ?? "active",
    createdAt: NOW,
    updatedAt: NOW,
    version: 1 as Team["version"],
  };
  await eventRepository.create(event);
  await competitionRepository.create(competition);
  if (o.division !== "none") await divisionRepository.create(division);
  await athleteProfileRepository.create(athlete);
  await teamRepository.create(team);
  if ((o.participation ?? "active") !== "none") {
    const p: AthleteSportParticipation = {
      id: id<"AthleteSportParticipation">("participation"),
      athleteProfileId: athlete.id,
      sportId: id<"Sport">(
        o.participation === "wrong" ? "football" : "basketball",
      ),
      status: o.participation === "ended" ? "ended" : "active",
      startedAt: NOW,
      endedAt: o.participation === "ended" ? NOW : null,
    };
    await athleteProfileRepository.addParticipation(p);
  }
  const authorization = {
    execute: async () => ({
      ok: true as const,
      value: { allowed: o.allowed ?? true },
    }),
  } as unknown as AuthorizeOrganizationPermission;
  const deps = {
    eventRepository,
    competitionRepository,
    divisionRepository,
    competitionEntryRepository,
    athleteProfileRepository,
    teamRepository,
    authorization,
    clock: new FakeClock(NOW),
    idGenerator: new FakeIdGenerator([
      "entry-1",
      "event-1",
      "entry-2",
      "event-2",
      "event-3",
    ]),
    domainEvents,
  };
  return {
    deps,
    competitionEntryRepository,
    competition,
    division,
    team,
    domainEvents,
  };
}
describe("competition entry use cases", () => {
  it.each(["draft", "active"] as const)(
    "accepts athlete in %s Competition with optional active Division",
    async (status) => {
      const x = await setup({ competitionStatus: status });
      expect(
        await new CreateAthleteCompetitionEntry(x.deps).execute({
          actingMembershipId: "manager",
          competitionId: "competition",
          athleteProfileId: "athlete",
          divisionId: "division",
        }),
      ).toMatchObject({
        ok: true,
        value: {
          competitionEntry: { entrantType: "athlete", divisionId: "division" },
        },
      });
      expect(x.domainEvents.events[0]).toMatchObject({
        type: "competition.entry_created",
      });
    },
  );
  it.each(["completed", "cancelled"] as const)(
    "denies creation in %s Competition",
    async (status) => {
      const x = await setup({ competitionStatus: status });
      expect(
        await new CreateTeamCompetitionEntry(x.deps).execute({
          actingMembershipId: "manager",
          competitionId: "competition",
          teamId: "team",
        }),
      ).toMatchObject({ ok: false, error: { kind: "competition_closed" } });
    },
  );
  it("requires active matching athlete participation", async () => {
    for (const participation of ["wrong", "ended", "none"] as const) {
      const x = await setup({ participation });
      expect(
        await new CreateAthleteCompetitionEntry(x.deps).execute({
          actingMembershipId: "manager",
          competitionId: "competition",
          athleteProfileId: "athlete",
        }),
      ).toMatchObject({
        ok: false,
        error: { kind: "athlete_not_active_in_competition_sport" },
      });
    }
  });
  it("requires active matching team but permits a cross-Organization Team", async () => {
    const good = await setup({ teamOrg: "organization-b" });
    expect(
      await new CreateTeamCompetitionEntry(good.deps).execute({
        actingMembershipId: "organizer-a-manager",
        competitionId: "competition",
        teamId: "team",
      }),
    ).toMatchObject({ ok: true });
    for (const options of [
      { teamStatus: "inactive" as const },
      { teamSport: "football" },
    ]) {
      const x = await setup(options);
      expect(
        (
          await new CreateTeamCompetitionEntry(x.deps).execute({
            actingMembershipId: "manager",
            competitionId: "competition",
            teamId: "team",
          })
        ).ok,
      ).toBe(false);
    }
  });
  it("denies wrong/inactive Divisions and unauthorized actors", async () => {
    for (const options of [
      { division: "wrong" as const },
      { division: "inactive" as const },
      { allowed: false },
    ]) {
      const x = await setup(options);
      expect(
        (
          await new CreateTeamCompetitionEntry(x.deps).execute({
            actingMembershipId: "actor",
            competitionId: "competition",
            teamId: "team",
            divisionId: "division",
          })
        ).ok,
      ).toBe(false);
    }
  });
  it("withdraws without revalidation and re-entry creates a new active row", async () => {
    const x = await setup({
      competitionStatus: "cancelled",
      teamStatus: "inactive",
      participation: "ended",
    });
    const made = createCompetitionEntry({
      id: id<"CompetitionEntry">("old-entry"),
      competitionId: x.competition.id,
      entrantType: "team",
      teamId: x.team.id,
      ...meta,
    });
    if (!made.ok) throw Error();
    await x.competitionEntryRepository.create(made.value.entry);
    expect(
      await new WithdrawCompetitionEntry(x.deps).execute({
        actingMembershipId: "manager",
        competitionEntryId: "old-entry",
        expectedVersion: 1,
      }),
    ).toMatchObject({
      ok: true,
      value: { competitionEntry: { status: "withdrawn", version: 2 } },
    });
    x.competition.status = "draft";
    x.team.status = "active";
    const reentry = await new CreateTeamCompetitionEntry(x.deps).execute({
      actingMembershipId: "manager",
      competitionId: "competition",
      teamId: "team",
    });
    expect(reentry).toMatchObject({
      ok: true,
      value: { competitionEntry: { status: "active" } },
    });
    if (!reentry.ok) throw Error();
    expect(reentry.value.competitionEntry.id).not.toBe("old-entry");
    expect(
      await x.competitionEntryRepository.findById(
        id<"CompetitionEntry">("old-entry"),
      ),
    ).toMatchObject({ competitionEntry: { status: "withdrawn" } });
  });
});
