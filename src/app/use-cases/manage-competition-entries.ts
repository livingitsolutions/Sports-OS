import type {
  AthleteProfileRepository,
  Clock,
  CompetitionEntryRepository,
  CompetitionRepository,
  DivisionRepository,
  DomainEventPublisher,
  EventRepository,
  IdGenerator,
  TeamRepository,
} from "@app/contracts";
import type { AuthorizeOrganizationPermission } from "@app/use-cases/authorize-organization-permission";
import {
  createCompetitionEntry,
  withdrawCompetitionEntry,
} from "@domain/competition/competition-entry";
import type { Competition } from "@domain/competition/competition.types";
import type { Id, Result } from "@shared/kernel";

export type CompetitionEntryError = {
  kind:
    | "not_found"
    | "forbidden"
    | "competition_closed"
    | "division_mismatch"
    | "division_inactive"
    | "athlete_not_active_in_competition_sport"
    | "team_inactive"
    | "team_sport_mismatch"
    | "already_active"
    | "already_withdrawn"
    | "concurrency_conflict"
    | "invalid_input"
    | "persistence_unavailable";
  code: string;
  message: string;
};
const fail = (
  kind: CompetitionEntryError["kind"],
  message: string,
): Result<never, CompetitionEntryError> => ({
  ok: false,
  error: { kind, code: kind, message },
});
type Base = {
  competitionEntryRepository: CompetitionEntryRepository;
  competitionRepository: CompetitionRepository;
  divisionRepository: DivisionRepository;
  eventRepository: EventRepository;
  authorization: AuthorizeOrganizationPermission;
  clock: Clock;
  idGenerator: IdGenerator;
  domainEvents: DomainEventPublisher;
};

async function loadAndAuthorize(
  d: Base,
  competitionId: Id<"Competition">,
  membershipId: string,
): Promise<Result<Competition, CompetitionEntryError>> {
  const c = await d.competitionRepository.findById(competitionId);
  if (c.kind !== "found")
    return fail("not_found", "Competition does not exist.");
  const e = await d.eventRepository.findById(c.competition.eventId);
  if (e.kind !== "found")
    return fail("not_found", "Owning Event does not exist.");
  const auth = await d.authorization.execute({
    organizationId: e.event.organizationId,
    membershipId,
    permission: "organization.events.manage",
  });
  if (!auth.ok || !auth.value.allowed)
    return fail("forbidden", "Competition entry management is not permitted.");
  return { ok: true, value: c.competition };
}
async function validateDivision(
  d: Base,
  c: Competition,
  divisionId?: string | null,
): Promise<Result<Id<"Division"> | null, CompetitionEntryError>> {
  if (!divisionId) return { ok: true, value: null };
  const x = await d.divisionRepository.findById(divisionId as Id<"Division">);
  if (x.kind !== "found" || x.division.competitionId !== c.id)
    return fail(
      "division_mismatch",
      "Division must belong to the Competition.",
    );
  if (x.division.status !== "active")
    return fail("division_inactive", "Division must be active.");
  return { ok: true, value: x.division.id };
}
function persistence(kind: string) {
  return kind === "already_active"
    ? fail("already_active", "Entrant already has an active entry.")
    : fail(
        "persistence_unavailable",
        "Competition entry could not be persisted.",
      );
}

export class CreateAthleteCompetitionEntry {
  constructor(
    private readonly d: Base & {
      athleteProfileRepository: AthleteProfileRepository;
    },
  ) {}
  async execute(i: {
    actingMembershipId: string;
    competitionId: string;
    athleteProfileId: string;
    divisionId?: string | null;
  }) {
    const c = await loadAndAuthorize(
      this.d,
      i.competitionId as Id<"Competition">,
      i.actingMembershipId,
    );
    if (!c.ok) return c;
    if (c.value.status === "completed" || c.value.status === "cancelled")
      return fail(
        "competition_closed",
        "Competition no longer accepts entries.",
      );
    const division = await validateDivision(this.d, c.value, i.divisionId);
    if (!division.ok) return division;
    const athleteId = i.athleteProfileId as Id<"AthleteProfile">;
    const profile = await this.d.athleteProfileRepository.findById(athleteId);
    if (!profile) return fail("not_found", "AthleteProfile does not exist.");
    if (
      !(await this.d.athleteProfileRepository.findActiveParticipation(
        athleteId,
        c.value.sportId,
      ))
    )
      return fail(
        "athlete_not_active_in_competition_sport",
        "Athlete is not active in the Competition sport.",
      );
    if (
      (
        await this.d.competitionEntryRepository.findActiveAthleteEntry(
          c.value.id,
          athleteId,
        )
      ).kind === "found"
    )
      return fail("already_active", "Athlete already has an active entry.");
    const made = createCompetitionEntry({
      id: this.d.idGenerator.next("CompetitionEntry"),
      competitionId: c.value.id,
      divisionId: division.value,
      entrantType: "athlete",
      athleteProfileId: athleteId,
      now: this.d.clock.now(),
      domainEventId: this.d.idGenerator.next("DomainEvent"),
    });
    if (!made.ok) return fail("invalid_input", made.error.message);
    const saved = await this.d.competitionEntryRepository.create(
      made.value.entry,
    );
    if (!saved.ok) return persistence(saved.error.kind);
    await this.d.domainEvents.publish(made.value.event);
    return { ok: true as const, value: { competitionEntry: saved.value } };
  }
}

export class CreateTeamCompetitionEntry {
  constructor(private readonly d: Base & { teamRepository: TeamRepository }) {}
  async execute(i: {
    actingMembershipId: string;
    competitionId: string;
    teamId: string;
    divisionId?: string | null;
  }) {
    const c = await loadAndAuthorize(
      this.d,
      i.competitionId as Id<"Competition">,
      i.actingMembershipId,
    );
    if (!c.ok) return c;
    if (c.value.status === "completed" || c.value.status === "cancelled")
      return fail(
        "competition_closed",
        "Competition no longer accepts entries.",
      );
    const division = await validateDivision(this.d, c.value, i.divisionId);
    if (!division.ok) return division;
    const teamId = i.teamId as Id<"Team">;
    const team = await this.d.teamRepository.findById(teamId);
    if (team.kind !== "found") return fail("not_found", "Team does not exist.");
    if (team.team.status !== "active")
      return fail("team_inactive", "Team must be active.");
    if (team.team.sportId !== c.value.sportId)
      return fail(
        "team_sport_mismatch",
        "Team sport must match the Competition sport.",
      );
    if (
      (
        await this.d.competitionEntryRepository.findActiveTeamEntry(
          c.value.id,
          teamId,
        )
      ).kind === "found"
    )
      return fail("already_active", "Team already has an active entry.");
    const made = createCompetitionEntry({
      id: this.d.idGenerator.next("CompetitionEntry"),
      competitionId: c.value.id,
      divisionId: division.value,
      entrantType: "team",
      teamId,
      now: this.d.clock.now(),
      domainEventId: this.d.idGenerator.next("DomainEvent"),
    });
    if (!made.ok) return fail("invalid_input", made.error.message);
    const saved = await this.d.competitionEntryRepository.create(
      made.value.entry,
    );
    if (!saved.ok) return persistence(saved.error.kind);
    await this.d.domainEvents.publish(made.value.event);
    return { ok: true as const, value: { competitionEntry: saved.value } };
  }
}

export class WithdrawCompetitionEntry {
  constructor(private readonly d: Base) {}
  async execute(i: {
    actingMembershipId: string;
    competitionEntryId: string;
    expectedVersion: number;
  }) {
    const found = await this.d.competitionEntryRepository.findById(
      i.competitionEntryId as Id<"CompetitionEntry">,
    );
    if (found.kind !== "found")
      return fail("not_found", "CompetitionEntry does not exist.");
    const c = await loadAndAuthorize(
      this.d,
      found.competitionEntry.competitionId,
      i.actingMembershipId,
    );
    if (!c.ok) return c;
    const made = withdrawCompetitionEntry(found.competitionEntry, {
      now: this.d.clock.now(),
      domainEventId: this.d.idGenerator.next("DomainEvent"),
    });
    if (!made.ok) return fail("already_withdrawn", made.error.message);
    const saved = await this.d.competitionEntryRepository.save(
      made.value.entry,
      i.expectedVersion,
    );
    if (!saved.ok)
      return saved.error.kind === "concurrency_conflict"
        ? fail(
            "concurrency_conflict",
            "Competition entry was changed concurrently.",
          )
        : fail(
            "persistence_unavailable",
            "Competition entry could not be saved.",
          );
    await this.d.domainEvents.publish(made.value.event);
    return { ok: true as const, value: { competitionEntry: saved.value } };
  }
}
