import { SystemClock } from "@adapters/clock/system-clock";
import { NoopEventPublisher } from "@adapters/events/noop-event-publisher";
import { UuidIdGenerator } from "@adapters/id/uuid-id-generator";
import { createSql, readPgConfigFromEnv } from "@adapters/persistence/pg/connection";
import { PgCompetitionEntryRepository } from "@adapters/persistence/pg/pg-competition-entry-repository";
import { PgCompetitionFormatRepository } from "@adapters/persistence/pg/pg-competition-format-repository";
import { PgCompetitionSeedAssignmentRepository } from "@adapters/persistence/pg/pg-competition-seed-assignment-repository";
import { PgCompetitionSeedFinalizer } from "@adapters/persistence/pg/pg-competition-seed-finalizer";
import {
  PgCompetitionRepository,
  PgDivisionRepository,
  PgEventRepository,
  PgStageRepository,
} from "@adapters/persistence/pg/pg-competition-repositories";
import { PgCompetitionStructureMaterializer } from "@adapters/persistence/pg/pg-competition-structure-materializer";
import { PgInitialContestParticipantMaterializer } from "@adapters/persistence/pg/pg-initial-contest-participant-materializer";
import {
  PgOrganizationRoleAssignmentRepository,
  PgOrganizationRoleRepository,
} from "@adapters/persistence/pg/pg-organization-authorization-repositories";
import { PgOrganizationMembershipRepository } from "@adapters/persistence/pg/pg-organization-membership-repository";
import { PgOrganizationRepository } from "@adapters/persistence/pg/pg-organization-repository";
import { PgSportDirectory } from "@adapters/persistence/pg/pg-sport-directory";
import { PgTeamRepository } from "@adapters/persistence/pg/pg-team-repository";
import type { DomainEvent } from "@app/contracts/events";
import { AssignCompetitionEntrySeed } from "@app/use-cases/assign-competition-entry-seed";
import { AuthorizeOrganizationPermission } from "@app/use-cases/authorize-organization-permission";
import { CreateEvent, CreateCompetition } from "@app/use-cases/competition-foundation";
import { CreateTeam } from "@app/use-cases/create-team";
import { FinalizeCompetitionSeedAssignments } from "@app/use-cases/finalize-competition-seed-assignments";
import { CreateTeamCompetitionEntry } from "@app/use-cases/manage-competition-entries";
import { CreateCompetitionFormat } from "@app/use-cases/manage-competition-format";
import { MaterializeCompetitionFormatPlan } from "@app/use-cases/materialize-competition-format-plan";
import { MaterializeInitialContestParticipants } from "@app/use-cases/materialize-initial-contest-participants";
import { createCompetitionFormatEngineRegistry } from "@composition/competition-format-engines";

const ORGANIZATION_ID = "b6c455fa-5b58-42ac-90e6-36bdfe7673c1";
const MEMBERSHIP_ID = "49ac340e-4ae7-4dbf-9b5d-866a326e5f43";
const BASKETBALL_SPORT_ID = "sport-basketball";
const PILOT_KEY_PREFIX = "sportsos-controlled-pilot-six-team";

function requireSuccess<T>(result: { ok: true; value: T } | { ok: false }): T {
  if (!result.ok) throw new Error("Pilot application use case failed.");
  return result.value;
}

async function initialize(): Promise<void> {
  if (process.env.SPORTSOS_ALLOW_PILOT_INITIALIZE !== "YES") {
    throw new Error("Pilot initialization guard is not enabled.");
  }

  // Deliberately pass only DATABASE_URL so this initializer cannot select TEST_DATABASE_URL
  // or the production composition fallback.
  const config = readPgConfigFromEnv({ DATABASE_URL: process.env.DATABASE_URL });
  const sql = createSql(config);

  try {
    const clock = new SystemClock();
    const idGenerator = new UuidIdGenerator();
    const domainEvents = new NoopEventPublisher<DomainEvent>();
    const organizationRepository = new PgOrganizationRepository(sql);
    const sportDirectory = new PgSportDirectory(sql);
    const teamRepository = new PgTeamRepository(sql);
    const eventRepository = new PgEventRepository(sql);
    const competitionRepository = new PgCompetitionRepository(sql);
    const divisionRepository = new PgDivisionRepository(sql);
    const stageRepository = new PgStageRepository(sql);
    const competitionEntryRepository = new PgCompetitionEntryRepository(sql);
    const competitionFormatRepository = new PgCompetitionFormatRepository(sql);
    const structure = new PgCompetitionStructureMaterializer(sql);
    const assignmentRepository = new PgCompetitionSeedAssignmentRepository(sql);
    const engines = createCompetitionFormatEngineRegistry();
    const authorization = new AuthorizeOrganizationPermission({
      membershipRepository: new PgOrganizationMembershipRepository(sql),
      roleRepository: new PgOrganizationRoleRepository(sql),
      assignmentRepository: new PgOrganizationRoleAssignmentRepository(sql),
    });
    const common = { authorization, clock, idGenerator, domainEvents };
    const competitionCommon = {
      ...common,
      competitionFormatRepository,
      competitionRepository,
      divisionRepository,
      eventRepository,
      competitionEntryRepository,
      engines,
    };

    const createTeam = new CreateTeam({
      ...common,
      repository: teamRepository,
      organizationRepository,
      sportDirectory,
    });
    const teams = [];
    for (let number = 1; number <= 6; number += 1) {
      const created = requireSuccess(await createTeam.execute({
        actingMembershipId: MEMBERSHIP_ID,
        organizationId: ORGANIZATION_ID,
        sportId: BASKETBALL_SPORT_ID,
        name: `Pilot Team ${number}`,
        key: `${PILOT_KEY_PREFIX}-team-${number}`,
      }));
      teams.push(created.team);
    }

    const event = requireSuccess(await new CreateEvent({
      ...common,
      repository: eventRepository,
    }).execute({
      actingMembershipId: MEMBERSHIP_ID,
      organizationId: ORGANIZATION_ID,
      name: "SportsOS Controlled Pilot",
      key: `${PILOT_KEY_PREFIX}-event`,
    }));

    const competition = requireSuccess(await new CreateCompetition({
      ...common,
      eventRepository,
      competitionRepository,
      divisionRepository,
      stageRepository,
      sportDirectory,
    }).execute({
      actingMembershipId: MEMBERSHIP_ID,
      eventId: event.event.id,
      sportId: BASKETBALL_SPORT_ID,
      name: "SportsOS Six-Team Single Elimination",
      key: `${PILOT_KEY_PREFIX}-competition`,
    }));

    const createEntry = new CreateTeamCompetitionEntry({
      ...common,
      competitionEntryRepository,
      competitionRepository,
      divisionRepository,
      eventRepository,
      teamRepository,
    });
    const entries = [];
    for (const team of teams) {
      const created = requireSuccess(await createEntry.execute({
        actingMembershipId: MEMBERSHIP_ID,
        competitionId: competition.competition.id,
        teamId: team.id,
        divisionId: null,
      }));
      entries.push(created.competitionEntry);
    }

    const format = requireSuccess(await new CreateCompetitionFormat({
      ...common,
      competitionFormatRepository,
      competitionRepository,
      divisionRepository,
      eventRepository,
    }).execute({
      actingMembershipId: MEMBERSHIP_ID,
      competitionId: competition.competition.id,
      divisionId: null,
      kind: "single_elimination",
    }));

    const materialized = requireSuccess(await new MaterializeCompetitionFormatPlan({
      ...competitionCommon,
      materializer: structure,
    }).execute({ actingMembershipId: MEMBERSHIP_ID, competitionFormatId: format.competitionFormat.id }));

    const assignSeed = new AssignCompetitionEntrySeed({
      ...competitionCommon,
      assignmentRepository,
      materializer: structure,
    });
    for (let index = 0; index < entries.length; index += 1) {
      requireSuccess(await assignSeed.execute({
        actingMembershipId: MEMBERSHIP_ID,
        competitionFormatId: format.competitionFormat.id,
        competitionEntryId: entries[index]!.id,
        seedNumber: index + 1,
      }));
    }

    const finalized = requireSuccess(await new FinalizeCompetitionSeedAssignments({
      ...competitionCommon,
      assignmentRepository,
      materializer: structure,
      finalizer: new PgCompetitionSeedFinalizer(sql),
    }).execute({ actingMembershipId: MEMBERSHIP_ID, competitionFormatId: format.competitionFormat.id }));

    const participants = requireSuccess(await new MaterializeInitialContestParticipants({
      ...competitionCommon,
      assignmentRepository,
      structure,
      materializer: new PgInitialContestParticipantMaterializer(sql),
    }).execute({ actingMembershipId: MEMBERSHIP_ID, competitionFormatId: format.competitionFormat.id }));

    console.log(JSON.stringify({
      organizationId: ORGANIZATION_ID,
      membershipId: MEMBERSHIP_ID,
      eventId: event.event.id,
      competitionId: competition.competition.id,
      competitionFormatId: format.competitionFormat.id,
      teamIds: teams.map((team) => team.id),
      competitionEntryIds: entries.map((entry) => entry.id),
      stageCount: materialized.stageCount,
      contestCount: materialized.contestCount,
      seedCount: finalized.seedCount,
      participantCount: participants.participantCount,
      status: "PILOT_INITIALIZED",
    }, null, 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

initialize().catch(() => {
  console.error("PILOT_INITIALIZATION_FAILED");
  process.exitCode = 1;
});
