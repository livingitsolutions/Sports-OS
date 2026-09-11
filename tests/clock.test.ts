import { describe, it, expect } from "vitest";
import { SystemClock } from "@adapters/clock/system-clock";
import { FakeClock } from "@adapters/clock/fake-clock";

describe("FakeClock", () => {
  it("returns its fixed start instant deterministically", () => {
    const clock = new FakeClock("2026-01-01T00:00:00.000Z");
    expect(clock.now()).toBe("2026-01-01T00:00:00.000Z");
    expect(clock.now()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("only moves when advanced", () => {
    const clock = new FakeClock("2026-01-01T00:00:00.000Z");
    clock.advance(1500);
    expect(clock.now()).toBe("2026-01-01T00:00:01.500Z");
  });

  it("can be set to an absolute instant", () => {
    const clock = new FakeClock();
    clock.set("2030-06-15T12:00:00.000Z");
    expect(clock.now()).toBe("2030-06-15T12:00:00.000Z");
  });
});

describe("SystemClock", () => {
  it("returns a valid, round-trippable ISO-8601 timestamp", () => {
    const value = new SystemClock().now();
    expect(new Date(value).toISOString()).toBe(value);
  });
});
