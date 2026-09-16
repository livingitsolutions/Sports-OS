import { createClient } from "@supabase/supabase-js";
import { SupabaseAuthIdentityProvider } from "@adapters/auth/supabase-auth-identity-provider";
import {
  createSql,
  readPgConfigFromEnv,
} from "@adapters/persistence/pg/connection";
import { PgAccountRepository } from "@adapters/persistence/pg/pg-account-repository";
import { PgPersonRepository } from "@adapters/persistence/pg/pg-person-repository";
import { PgOrganizationRepository } from "@adapters/persistence/pg/pg-organization-repository";
import { PgOrganizationMembershipRepository } from "@adapters/persistence/pg/pg-organization-membership-repository";
import {
  PgOrganizationRoleAssignmentRepository,
  PgOrganizationRoleRepository,
} from "@adapters/persistence/pg/pg-organization-authorization-repositories";
import { PgTournamentOperationsReader } from "@adapters/persistence/pg/pg-tournament-operations-reader";
import { AuthorizeOrganizationPermission } from "@app/use-cases/authorize-organization-permission";
import { GetTournamentOperationsView } from "@app/use-cases/get-tournament-operations-view";
import { GetOrganizerContext } from "@app/use-cases/get-organizer-context";
import { GetAuthenticatedTournamentOperationsView } from "@app/use-cases/get-authenticated-tournament-operations-view";
import { PgCompetitionFormatRepository } from "@adapters/persistence/pg/pg-competition-format-repository";
import {
  PgCompetitionRepository,
  PgContestRepository,
  PgDivisionRepository,
  PgEventRepository,
  PgStageRepository,
} from "@adapters/persistence/pg/pg-competition-repositories";
import { PgCompetitionStructureMaterializer } from "@adapters/persistence/pg/pg-competition-structure-materializer";
import { PgContestParticipantRepository } from "@adapters/persistence/pg/pg-contest-participant-repository";
import { PgContestResultProgressor } from "@adapters/persistence/pg/pg-contest-result-progressor";
import { PgContestResultRepository } from "@adapters/persistence/pg/pg-contest-result-repository";
import { RecordContestResult } from "@app/use-cases/record-contest-result";
import { ProgressFinalizedContestResult } from "@app/use-cases/progress-finalized-contest-result";
import { FinalizeOrganizerMatchResult } from "@app/use-cases/finalize-organizer-match-result";
import { RetryOrganizerMatchProgression } from "@app/use-cases/retry-organizer-match-progression";
import { FinalizeOrganizerCompetitionOutcome } from "@app/use-cases/finalize-organizer-competition-outcome";
import { FinalizeCompetitionOutcome } from "@app/use-cases/finalize-competition-outcome";
import { PgCompetitionOutcomeFinalizer } from "@adapters/persistence/pg/pg-competition-outcome-finalizer";
import { SystemClock } from "@adapters/clock/system-clock";
import { UuidIdGenerator } from "@adapters/id/uuid-id-generator";
import { NoopEventPublisher } from "@adapters/events/noop-event-publisher";
import { createCompetitionFormatEngineRegistry } from "@composition/competition-format-engines";
export interface OrganizerRequestRuntime {
  readonly organizerContext: GetOrganizerContext;
  readonly tournamentOperations: GetAuthenticatedTournamentOperationsView;
  readonly finalizeMatch: FinalizeOrganizerMatchResult;
  readonly retryProgression: RetryOrganizerMatchProgression;
  readonly finalizeOutcome: FinalizeOrganizerCompetitionOutcome;
  close(): Promise<void>;
}
export function createOrganizerRequestRuntime(
  env: Record<string, string | undefined>,
  authorizationHeader: string,
): OrganizerRequestRuntime {
  const url = env.SUPABASE_URL,
    publicKey = env.SUPABASE_ANON_KEY;
  if (!url?.trim() || !publicKey?.trim())
    throw new Error(
      "Required Supabase server authentication configuration is missing.",
    );
  const client = createClient(url, publicKey, {
      global: { headers: { Authorization: authorizationHeader } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }),
    sql = createSql(readPgConfigFromEnv(env));
  const authIdentityProvider = new SupabaseAuthIdentityProvider(client),
    accountRepository = new PgAccountRepository(sql),
    personRepository = new PgPersonRepository(sql),
    membershipRepository = new PgOrganizationMembershipRepository(sql),
    organizationRepository = new PgOrganizationRepository(sql);
  const organizerContext = new GetOrganizerContext({
    authIdentityProvider,
    accountRepository,
    personRepository,
    membershipRepository,
    organizationRepository,
  });
  const authorization = new AuthorizeOrganizationPermission({
      membershipRepository,
      roleRepository: new PgOrganizationRoleRepository(sql),
      assignmentRepository: new PgOrganizationRoleAssignmentRepository(sql),
    }),
    base = new GetTournamentOperationsView({
      reader: new PgTournamentOperationsReader(sql),
      authorization,
    });
  const contestRepository = new PgContestRepository(sql),
    stageRepository = new PgStageRepository(sql),
    competitionRepository = new PgCompetitionRepository(sql),
    eventRepository = new PgEventRepository(sql),
    participants = new PgContestParticipantRepository(sql),
    results = new PgContestResultRepository(sql),
    clock = new SystemClock(),
    idGenerator = new UuidIdGenerator(),
    domainEvents = new NoopEventPublisher();
  const record = new RecordContestResult({
    contestRepository,
    stageRepository,
    competitionRepository,
    eventRepository,
    participantRepository: participants,
    recorder: results,
    authorization,
    clock,
    idGenerator,
    domainEvents,
  });
  const progress = new ProgressFinalizedContestResult({
    resultRepository: results,
    participantRepository: participants,
    contestRepository,
    stageRepository,
    competitionRepository,
    eventRepository,
    divisionRepository: new PgDivisionRepository(sql),
    formatRepository: new PgCompetitionFormatRepository(sql),
    structure: new PgCompetitionStructureMaterializer(sql),
    progressor: new PgContestResultProgressor(sql),
    engines: createCompetitionFormatEngineRegistry(),
    authorization,
    clock,
    idGenerator,
    domainEvents,
  });
  const finalizeOutcomeAuthority=new FinalizeCompetitionOutcome({formatRepository:new PgCompetitionFormatRepository(sql),competitionRepository,eventRepository,divisionRepository:new PgDivisionRepository(sql),structure:new PgCompetitionStructureMaterializer(sql),finalizer:new PgCompetitionOutcomeFinalizer(sql),engines:createCompetitionFormatEngineRegistry(),authorization,clock,idGenerator,domainEvents});
  return {
    organizerContext,
    tournamentOperations: new GetAuthenticatedTournamentOperationsView({
      organizerContext,
      tournamentOperations: base,
    }),
    finalizeMatch: new FinalizeOrganizerMatchResult({
      organizerContext,
      participants,
      record,
      progress,
    }),
    retryProgression:new RetryOrganizerMatchProgression({organizerContext,progress}),
    finalizeOutcome:new FinalizeOrganizerCompetitionOutcome({organizerContext,finalizeOutcome:finalizeOutcomeAuthority}),
    close: () => sql.end({ timeout: 5 }),
  };
}
