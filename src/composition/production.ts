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
import type { AppContainer } from "@composition/container";

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
  const athleteProfileRepository = new PgAthleteProfileRepository(sql);
  const sportDirectory = new PgSportDirectory(sql);

  const domainEvents = new NoopEventPublisher<DomainEvent>();
  const integrationEvents = new NoopEventPublisher<IntegrationEvent>();

  return {
    clock,
    idGenerator,
    sportsIdGenerator,
    personRepository,
    athleteProfileRepository,
    sportDirectory,
    domainEvents,
    integrationEvents,
    useCases: {
      createPerson: new CreatePerson({
        clock,
        idGenerator,
        sportsIdGenerator,
        personRepository,
        domainEvents,
      }),
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
