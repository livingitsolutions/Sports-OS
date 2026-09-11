import { describe, it, expect } from "vitest";
import { cruise } from "dependency-cruiser";
import config from "../.dependency-cruiser.cjs";

type Violation = { rule: { name: string; severity: string } };

async function cruiseWith(
  paths: string[],
  forbidden: unknown[],
): Promise<Violation[]> {
  const result = await cruise(paths, {
    ...(config.options ?? {}),
    validate: true,
    ruleSet: { forbidden },
  } as never);
  const output =
    typeof result.output === "string"
      ? JSON.parse(result.output)
      : result.output;
  return (output.summary?.violations ?? []) as Violation[];
}

const errorViolations = (violations: Violation[]): Violation[] =>
  violations.filter((v) => v.rule.severity === "error");

describe("architecture boundaries", () => {
  it("ships a forbidden ruleset covering the core boundaries", () => {
    const names = new Set(config.forbidden.map((r: { name: string }) => r.name));
    for (const required of [
      "no-circular",
      "domain-no-app",
      "domain-no-adapters",
      "domain-no-external-sdk",
      "no-cross-context",
      "app-no-adapters",
      "presentation-no-adapters",
    ]) {
      expect(names.has(required)).toBe(true);
    }
  });

  it("passes with zero error-severity violations on the real source tree", async () => {
    const violations = await cruiseWith(["src"], config.forbidden);
    expect(errorViolations(violations)).toEqual([]);
  });

  it("forbids one bounded context importing another's internals, even type-only", async () => {
    const fixtureRule = {
      name: "fixture-no-cross-context",
      severity: "error",
      from: { path: "^tests/fixtures/cross-context/([^/]+)/" },
      to: {
        path: "^tests/fixtures/cross-context/([^/]+)/",
        pathNot: ["^tests/fixtures/cross-context/$1/"],
      },
    };
    const violations = await cruiseWith(
      ["tests/fixtures/cross-context"],
      [fixtureRule],
    );
    expect(errorViolations(violations).length).toBeGreaterThan(0);
  });

  it("flags a module that imports the adapters layer across a forbidden boundary", async () => {
    const fixtureRule = {
      name: "fixture-no-adapters",
      severity: "error",
      from: { path: "^tests/fixtures/forbidden-domain" },
      to: { path: "^src/adapters" },
    };
    const violations = await cruiseWith(
      ["tests/fixtures/forbidden-domain"],
      [fixtureRule],
    );
    expect(errorViolations(violations).length).toBeGreaterThan(0);
  });
});
