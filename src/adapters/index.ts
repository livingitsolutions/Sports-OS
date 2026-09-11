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
export { InMemoryAthleteProfileRepository } from "@adapters/persistence/in-memory-athlete-profile-repository";
export { InMemorySportDirectory } from "@adapters/sports/in-memory-sport-directory";
export { InMemoryEventPublisher } from "@adapters/events/in-memory-event-publisher";
export { NoopEventPublisher } from "@adapters/events/noop-event-publisher";

export type { PgConfig, Sql } from "@adapters/persistence/pg/connection";
export {
  createSql,
  readPgConfigFromEnv,
} from "@adapters/persistence/pg/connection";
export { PgPersonRepository } from "@adapters/persistence/pg/pg-person-repository";
export { PgAthleteProfileRepository } from "@adapters/persistence/pg/pg-athlete-profile-repository";
export { PgSportDirectory } from "@adapters/persistence/pg/pg-sport-directory";

/** Thrown by a port that has no configured adapter in the current composition. */
export class NotConfiguredError extends Error {
  constructor(port: string) {
    super(`Port "${port}" has no configured adapter in this composition.`);
    this.name = "NotConfiguredError";
  }
}
