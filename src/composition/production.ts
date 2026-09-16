import { SystemClock } from "@adapters/clock/system-clock";
import { UuidIdGenerator } from "@adapters/id/uuid-id-generator";
import { RandomSportsIdGenerator } from "@adapters/id/sports-id-generator";
import { createSql, readPgConfigFromEnv } from "@adapters/persistence/pg/connection";
import { PgPersonRepository } from "@adapters/persistence/pg/pg-person-repository";
import { PgAthleteProfileRepository } from "@adapters/persistence/pg/pg-athlete-profile-repository";
import { PgSportDirectory } from "@adapters/persistence/pg/pg-sport-directory";
import { NoopEventPublisher } from "@adapters/events/noop-event-publisher";
import type { DomainEvent, IntegrationEvent } from "@app/contracts/events";
import { CreatePerson } from "@app/use-cases/create-person";
import { CreateAthleteProfile } from "@app/use-cases/create-athlete-profile";
import { AddAthleteSport } from "@app/use-cases/add-athlete-sport";
import { DeactivatePerson } from "@app/use-cases/deactivate-person";
import type { AppContainer } from "@composition/container";
import { PgOrganizationRepository } from "@adapters/persistence/pg/pg-organization-repository";
import { CreateOrganization } from "@app/use-cases/create-organization";
import {PgTournamentOperationsReader} from "@adapters/persistence/pg/pg-tournament-operations-reader";
import {PgOrganizationMembershipRepository} from "@adapters/persistence/pg/pg-organization-membership-repository";
import {PgOrganizationRoleAssignmentRepository,PgOrganizationRoleRepository} from "@adapters/persistence/pg/pg-organization-authorization-repositories";
import {AuthorizeOrganizationPermission} from "@app/use-cases/authorize-organization-permission";
import {GetTournamentOperationsView} from "@app/use-cases/get-tournament-operations-view";

/**
 * Production composition root. Wires real capability adapters to the
 * application contracts and constructs the available use cases.
 *
 * Person, Sports ID, athlete profile, participation, and sport lookups are
 * backed by PostgreSQL. The database connection is REQUIRED: composition reads
 * the connection string from the environment and fails loudly when it is
 * missing — there is no silent fallback to in-memory storage in production.
 *
 * Event delivery uses a no-op publisher until a real broker adapter exists.
 * Database durability and event publication are NOT yet atomic (no transactional
 * outbox): events are published only after persistence succeeds, so no
 * exactly-once delivery is claimed. No authentication or UI is wired here.
 */
export function createProductionContainer(): AppContainer {
  const clock = new SystemClock();
  const idGenerator = new UuidIdGenerator();
  const sportsIdGenerator = new RandomSportsIdGenerator();

  const sql = createSql(readPgConfigFromEnv());
  const personRepository = new PgPersonRepository(sql);
  const organizationRepository = new PgOrganizationRepository(sql);
  const athleteProfileRepository = new PgAthleteProfileRepository(sql);
  const sportDirectory = new PgSportDirectory(sql);
  const tournamentOperationsReader=new PgTournamentOperationsReader(sql);
  const authorization=new AuthorizeOrganizationPermission({membershipRepository:new PgOrganizationMembershipRepository(sql),roleRepository:new PgOrganizationRoleRepository(sql),assignmentRepository:new PgOrganizationRoleAssignmentRepository(sql)});

  const domainEvents = new NoopEventPublisher<DomainEvent>();
  const integrationEvents = new NoopEventPublisher<IntegrationEvent>();

  return {
    clock,
    idGenerator,
    sportsIdGenerator,
    personRepository,
    organizationRepository,
    athleteProfileRepository,
    sportDirectory,
    domainEvents,
    integrationEvents,
    tournamentOperationsReader,
    useCases: {
      createPerson: new CreatePerson({
        clock,
        idGenerator,
        sportsIdGenerator,
        personRepository,
        domainEvents,
      }),
      createOrganization: new CreateOrganization({ clock, idGenerator, organizationRepository, domainEvents }),
      getTournamentOperationsView:new GetTournamentOperationsView({reader:tournamentOperationsReader,authorization}),
      deactivatePerson: new DeactivatePerson({ clock, idGenerator, personRepository, domainEvents }),
      createAthleteProfile: new CreateAthleteProfile({
        clock,
        idGenerator,
        personRepository,
        athleteProfileRepository,
        domainEvents,
      }),
      addAthleteSport: new AddAthleteSport({
        clock,
        idGenerator,
        athleteProfileRepository,
        sportDirectory,
        domainEvents,
      }),
    },
  };
}
