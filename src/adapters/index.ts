/**
 * Adapter registry. Adapters are the ONLY place infrastructure and platform
 * capabilities are implemented. They depend inward on application contracts and
 * domain/shared types; nothing in the domain or application layers imports an
 * adapter directly — wiring happens in the composition root.
 */

export { SystemClock } from "@adapters/clock/system-clock";
export { FakeClock } from "@adapters/clock/fake-clock";
export { UuidIdGenerator } from "@adapters/id/uuid-id-generator";
export { FakeIdGenerator } from "@adapters/id/fake-id-generator";
export { RandomSportsIdGenerator } from "@adapters/id/sports-id-generator";
export { FakeSportsIdGenerator } from "@adapters/id/fake-sports-id-generator";
export { InMemoryPersonRepository } from "@adapters/persistence/in-memory-person-repository";
export { InMemoryOrganizationRepository } from "@adapters/persistence/in-memory-organization-repository";
export { InMemoryOrganizationMembershipRepository } from "@adapters/persistence/in-memory-organization-membership-repository";
export { InMemoryOrganizationRoleRepository, InMemoryOrganizationRoleAssignmentRepository } from "@adapters/persistence/in-memory-organization-authorization-repositories";
export { InMemoryOrganizationTrustRepository } from "@adapters/persistence/in-memory-organization-trust-repository";
export { InMemoryAthleteProfileRepository } from "@adapters/persistence/in-memory-athlete-profile-repository";
export { InMemoryTeamRepository } from "@adapters/persistence/in-memory-team-repository";
export { InMemoryTeamRosterMembershipRepository } from "@adapters/persistence/in-memory-team-roster-membership-repository";
export { InMemoryEventRepository,InMemoryCompetitionRepository,InMemoryDivisionRepository,InMemoryStageRepository,InMemoryContestRepository } from "@adapters/persistence/in-memory-competition-repositories";
export { InMemoryCompetitionEntryRepository } from "@adapters/persistence/in-memory-competition-entry-repository";
export { InMemoryCompetitionFormatRepository } from "@adapters/persistence/in-memory-competition-format-repository";
export { InMemoryCompetitionSeedAssignmentRepository } from "@adapters/persistence/in-memory-competition-seed-assignment-repository";
export { InMemoryCompetitionSeedFinalizer } from "@adapters/persistence/in-memory-competition-seed-finalizer";
export { InMemoryContestParticipantRepository } from "@adapters/persistence/in-memory-contest-participant-repository";
export { InMemoryContestResultRepository } from "@adapters/persistence/in-memory-contest-result-repository";
export { InMemoryContestResultProgressor } from "@adapters/persistence/in-memory-contest-result-progressor";
export { InMemoryCompetitionOutcomeFinalizer } from "@adapters/persistence/in-memory-competition-outcome-finalizer";
export { InMemoryInitialContestParticipantMaterializer } from "@adapters/persistence/in-memory-initial-contest-participant-materializer";
export { InMemorySportDirectory } from "@adapters/sports/in-memory-sport-directory";
export { InMemoryEventPublisher } from "@adapters/events/in-memory-event-publisher";
export { NoopEventPublisher } from "@adapters/events/noop-event-publisher";

export type { PgConfig, Sql } from "@adapters/persistence/pg/connection";
export {
  createSql,
  readPgConfigFromEnv,
} from "@adapters/persistence/pg/connection";
export { PgPersonRepository } from "@adapters/persistence/pg/pg-person-repository";
export { PgOrganizationRepository } from "@adapters/persistence/pg/pg-organization-repository";
export { PgOrganizationMembershipRepository } from "@adapters/persistence/pg/pg-organization-membership-repository";
export { PgOrganizationRoleRepository, PgOrganizationRoleAssignmentRepository } from "@adapters/persistence/pg/pg-organization-authorization-repositories";
export { PgOrganizationTrustRepository } from "@adapters/persistence/pg/pg-organization-trust-repository";
export { PgOrganizationBootstrapRepository } from "@adapters/persistence/pg/pg-organization-bootstrap-repository";
export { PgAthleteProfileRepository } from "@adapters/persistence/pg/pg-athlete-profile-repository";
export { PgSportDirectory } from "@adapters/persistence/pg/pg-sport-directory";
export { PgTeamRepository } from "@adapters/persistence/pg/pg-team-repository";
export { PgTeamRosterMembershipRepository } from "@adapters/persistence/pg/pg-team-roster-membership-repository";
export { PgEventRepository,PgCompetitionRepository,PgDivisionRepository,PgStageRepository,PgContestRepository } from "@adapters/persistence/pg/pg-competition-repositories";
export { PgCompetitionEntryRepository } from "@adapters/persistence/pg/pg-competition-entry-repository";
export { PgCompetitionFormatRepository } from "@adapters/persistence/pg/pg-competition-format-repository";
export { PgCompetitionSeedAssignmentRepository } from "@adapters/persistence/pg/pg-competition-seed-assignment-repository";
export { PgCompetitionSeedFinalizer } from "@adapters/persistence/pg/pg-competition-seed-finalizer";
export { PgContestParticipantRepository } from "@adapters/persistence/pg/pg-contest-participant-repository";
export { PgContestResultRepository } from "@adapters/persistence/pg/pg-contest-result-repository";
export { PgContestResultProgressor } from "@adapters/persistence/pg/pg-contest-result-progressor";
export { PgCompetitionOutcomeFinalizer } from "@adapters/persistence/pg/pg-competition-outcome-finalizer";
export { PgInitialContestParticipantMaterializer } from "@adapters/persistence/pg/pg-initial-contest-participant-materializer";

/** Thrown by a port that has no configured adapter in the current composition. */
export class NotConfiguredError extends Error {
  constructor(port: string) {
    super(`Port "${port}" has no configured adapter in this composition.`);
    this.name = "NotConfiguredError";
  }
}
export { InMemoryCompetitionStructureMaterializer } from "@adapters/persistence/in-memory-competition-structure-materializer";
export { PgCompetitionStructureMaterializer } from "@adapters/persistence/pg/pg-competition-structure-materializer";
