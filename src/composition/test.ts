import { FakeClock } from "@adapters/clock/fake-clock";
import { FakeIdGenerator } from "@adapters/id/fake-id-generator";
import { FakeSportsIdGenerator } from "@adapters/id/fake-sports-id-generator";
import { InMemoryPersonRepository } from "@adapters/persistence/in-memory-person-repository";
import { InMemoryAthleteProfileRepository } from "@adapters/persistence/in-memory-athlete-profile-repository";
import { InMemorySportDirectory } from "@adapters/sports/in-memory-sport-directory";
import { InMemoryEventPublisher } from "@adapters/events/in-memory-event-publisher";
import type { DomainEvent, IntegrationEvent } from "@app/contracts/events";
import { CreatePerson } from "@app/use-cases/create-person";
import { CreateAthleteProfile } from "@app/use-cases/create-athlete-profile";
import { AddAthleteSport } from "@app/use-cases/add-athlete-sport";
import { DeactivatePerson } from "@app/use-cases/deactivate-person";
import type { AppContainer } from "@composition/container";
import { InMemoryOrganizationRepository } from "@adapters/persistence/in-memory-organization-repository";
import { CreateOrganization } from "@app/use-cases/create-organization";
import { InMemoryOrganizationMembershipRepository } from "@adapters/persistence/in-memory-organization-membership-repository";
import { CreateOrganizationMembership } from "@app/use-cases/create-organization-membership";
import { DeactivateOrganizationMembership, ReactivateOrganizationMembership } from "@app/use-cases/change-organization-membership-status";

/**
 * Test composition root. Wires deterministic capability adapters so use-case
 * tests are reproducible. Exposes the concrete deterministic types so a test
 * can advance the clock, force a Sports ID collision, seed a known sport,
 * inspect the repositories, or assert on recorded events, while still
 * satisfying AppContainer.
 */
export interface TestContainer extends AppContainer {
  readonly clock: FakeClock;
  readonly idGenerator: FakeIdGenerator;
  readonly sportsIdGenerator: FakeSportsIdGenerator;
  readonly personRepository: InMemoryPersonRepository;
  readonly organizationRepository: InMemoryOrganizationRepository;
  readonly organizationMembershipRepository: InMemoryOrganizationMembershipRepository;
  readonly membershipUseCases: {
    readonly create: CreateOrganizationMembership;
    readonly deactivate: DeactivateOrganizationMembership;
    readonly reactivate: ReactivateOrganizationMembership;
  };
  readonly athleteProfileRepository: InMemoryAthleteProfileRepository;
  readonly sportDirectory: InMemorySportDirectory;
  readonly domainEvents: InMemoryEventPublisher<DomainEvent>;
  readonly integrationEvents: InMemoryEventPublisher<IntegrationEvent>;
}

export function createTestContainer(): TestContainer {
  const clock = new FakeClock();
  const idGenerator = new FakeIdGenerator();
  const sportsIdGenerator = new FakeSportsIdGenerator();
  const personRepository = new InMemoryPersonRepository();
  const organizationRepository = new InMemoryOrganizationRepository();
  const organizationMembershipRepository = new InMemoryOrganizationMembershipRepository();
  const athleteProfileRepository = new InMemoryAthleteProfileRepository();
  const sportDirectory = new InMemorySportDirectory();
  const domainEvents = new InMemoryEventPublisher<DomainEvent>();
  const integrationEvents = new InMemoryEventPublisher<IntegrationEvent>();

  return {
    clock,
    idGenerator,
    sportsIdGenerator,
    personRepository,
    organizationRepository,
    organizationMembershipRepository,
    membershipUseCases: {
      create: new CreateOrganizationMembership({ clock, idGenerator, membershipRepository: organizationMembershipRepository, personRepository, organizationRepository, domainEvents }),
      deactivate: new DeactivateOrganizationMembership({ clock, idGenerator, membershipRepository: organizationMembershipRepository, domainEvents }),
      reactivate: new ReactivateOrganizationMembership({ clock, idGenerator, membershipRepository: organizationMembershipRepository, domainEvents }),
    },
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
      createOrganization: new CreateOrganization({ clock, idGenerator, organizationRepository, domainEvents }),
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
