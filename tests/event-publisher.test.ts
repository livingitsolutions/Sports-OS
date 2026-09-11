import { describe, it, expect } from "vitest";
import { InMemoryEventPublisher } from "@adapters/events/in-memory-event-publisher";
import { NoopEventPublisher } from "@adapters/events/noop-event-publisher";
import { createTestContainer } from "@composition/test";
import type { IntegrationEvent } from "@app/contracts/events";

function sampleEvent(id: string): IntegrationEvent {
  return {
    eventId: id,
    occurredAt: "2026-01-01T00:00:00.000Z" as IntegrationEvent["occurredAt"],
    eventType: "test.sample",
    source: "test",
    version: 1,
    payload: {},
  };
}

describe("InMemoryEventPublisher", () => {
  it("records events in publish order", async () => {
    const publisher = new InMemoryEventPublisher<IntegrationEvent>();
    await publisher.publish(sampleEvent("a"));
    await publisher.publishAll([sampleEvent("b"), sampleEvent("c")]);
    expect(publisher.events.map((e) => e.eventId)).toEqual(["a", "b", "c"]);
  });

  it("clears recorded events", async () => {
    const publisher = new InMemoryEventPublisher<IntegrationEvent>();
    await publisher.publish(sampleEvent("a"));
    publisher.clear();
    expect(publisher.events).toHaveLength(0);
  });
});

describe("NoopEventPublisher", () => {
  it("accepts events without recording or throwing", async () => {
    const publisher = new NoopEventPublisher<IntegrationEvent>();
    await expect(publisher.publish(sampleEvent("a"))).resolves.toBeUndefined();
    await expect(publisher.publishAll([sampleEvent("b")])).resolves.toBeUndefined();
  });
});

describe("test composition root", () => {
  it("wires deterministic capabilities that interoperate", async () => {
    const container = createTestContainer();
    const id = container.idGenerator.next("Person");
    await container.integrationEvents.publish(sampleEvent(id));
    expect(id).toBe("test-Person-1");
    expect(container.clock.now()).toBe("2026-01-01T00:00:00.000Z");
    expect(container.integrationEvents.events).toHaveLength(1);
  });
});
