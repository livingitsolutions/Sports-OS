import { describe, expect, it } from "vitest";
import { CreateOrganization } from "@app/use-cases/create-organization";
import type { CreateOrganizationDeps } from "@app/use-cases/create-organization";
import { FakeClock } from "@adapters/clock/fake-clock";
import { FakeIdGenerator } from "@adapters/id/fake-id-generator";
import { InMemoryEventPublisher } from "@adapters/events/in-memory-event-publisher";
import { InMemoryOrganizationRepository } from "@adapters/persistence/in-memory-organization-repository";
import type { DomainEvent } from "@app/contracts/events";
function setup(overrides: Partial<CreateOrganizationDeps> = {}) { const organizationRepository = new InMemoryOrganizationRepository(); const domainEvents = new InMemoryEventPublisher<DomainEvent>(); return { organizationRepository, domainEvents, useCase: new CreateOrganization({ clock: new FakeClock(), idGenerator: new FakeIdGenerator(), organizationRepository, domainEvents, ...overrides }) }; }
const input = { name: "World Athletics", slug: "World Athletics", type: "federation", countryCode: "gb" };
describe("CreateOrganization", () => {
  it("checks availability, persists, then publishes", async () => { const { useCase, organizationRepository, domainEvents } = setup(); const result = await useCase.execute(input); expect(result.ok).toBe(true); expect(organizationRepository.size).toBe(1); expect(domainEvents.events).toHaveLength(1); expect(domainEvents.events[0]).toMatchObject({ type: "organization.organization_created", slug: "world-athletics" }); });
  it("returns duplicate slug and publishes nothing", async () => { const { useCase, domainEvents } = setup(); await useCase.execute(input); const result = await useCase.execute({ ...input, name: "Other" }); expect(result).toMatchObject({ ok: false, error: { kind: "duplicate_slug" } }); expect(domainEvents.events).toHaveLength(1); });
  it("returns invalid input and publishes nothing", async () => { const { useCase, domainEvents } = setup(); expect(await useCase.execute({ ...input, countryCode: "GBR" })).toMatchObject({ ok: false, error: { kind: "invalid_input" } }); expect(domainEvents.events).toHaveLength(0); });
  it("maps persistence unavailable and publishes nothing", async () => { const { useCase, domainEvents } = setup({ organizationRepository: { create: async () => ({ ok: false, error: { kind: "unavailable" } }), findById: async () => ({ kind: "not_found" }), findBySlug: async () => ({ kind: "not_found" }) } }); expect(await useCase.execute(input)).toMatchObject({ ok: false, error: { kind: "persistence_unavailable" } }); expect(domainEvents.events).toHaveLength(0); });
});
