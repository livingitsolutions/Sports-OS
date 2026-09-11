import { describe, it, expect } from "vitest";
import { UuidIdGenerator } from "@adapters/id/uuid-id-generator";
import { FakeIdGenerator } from "@adapters/id/fake-id-generator";

describe("FakeIdGenerator", () => {
  it("produces deterministic, per-brand sequential ids", () => {
    const gen = new FakeIdGenerator();
    expect(gen.next("Person")).toBe("test-Person-1");
    expect(gen.next("Person")).toBe("test-Person-2");
    expect(gen.next("Sport")).toBe("test-Sport-1");
  });

  it("restarts counters after reset", () => {
    const gen = new FakeIdGenerator();
    gen.next("Person");
    gen.reset();
    expect(gen.next("Person")).toBe("test-Person-1");
  });

  it("honors a custom prefix", () => {
    const gen = new FakeIdGenerator("fixture");
    expect(gen.next("Team")).toBe("fixture-Team-1");
  });
});

describe("UuidIdGenerator", () => {
  it("produces distinct UUID-shaped ids", () => {
    const gen = new UuidIdGenerator();
    const a = gen.next("Person");
    const b = gen.next("Person");
    expect(a).not.toBe(b);
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});
