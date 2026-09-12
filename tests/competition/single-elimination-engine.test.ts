import { describe, expect, it } from "vitest";
import { createCompetitionFormatEngineRegistry } from "@composition/competition-format-engines";
import {
  SingleEliminationEngine,
  singleEliminationBracketMath,
  standardSeedPlacement,
} from "@domain/competition/single-elimination-engine";
import type { CompetitionFormatPlan } from "@domain/competition/competition-format-engine";

const engine = new SingleEliminationEngine();
const input = (entrantCount: number) => ({ formatKind: "single_elimination" as const, entrantCount });

function planFor(entrantCount: number): CompetitionFormatPlan {
  const result = engine.plan(input(entrantCount));
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe("SingleEliminationEngine", () => {
  it.each([0, 1, -1, 2.5, Number.NaN])("rejects invalid entrantCount %s", (entrantCount) => {
    expect(engine.plan(input(entrantCount))).toMatchObject({
      ok: false,
      error: { kind: "invalid_input", code: "invalid_entrant_count" },
    });
  });

  it("rejects use for a different format kind", () => {
    expect(engine.plan({ formatKind: "swiss", entrantCount: 8 })).toMatchObject({
      ok: false,
      error: { kind: "invalid_input", code: "invalid_format_kind" },
    });
  });

  it.each([
    [2, 2, 0, 1], [3, 4, 1, 2], [4, 4, 0, 2], [5, 8, 3, 3], [6, 8, 2, 3],
    [7, 8, 1, 3], [8, 8, 0, 3], [9, 16, 7, 4], [16, 16, 0, 4],
  ])("calculates bracket math for %i entrants", (entrants, bracketSize, byeCount, roundCount) => {
    expect(singleEliminationBracketMath(entrants)).toEqual({ bracketSize, byeCount, roundCount });
  });

  it("uses deterministic balanced standard seed placement", () => {
    expect(standardSeedPlacement(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    const placement = standardSeedPlacement(16);
    expect(Math.floor(placement.indexOf(1) / 8)).not.toBe(Math.floor(placement.indexOf(2) / 8));
    expect(new Set([1, 2, 3, 4].map((seed) => Math.floor(placement.indexOf(seed) / 4))).size).toBe(4);
  });

  it.each([
    [3, [1]], [5, [1, 2, 3]], [6, [1, 2]], [7, [1]],
  ])("gives top seeds structural byes for %i entrants", (entrants, expectedByeSeeds) => {
    const plan = planFor(entrants);
    const firstStageRef = plan.stages[0].ref;
    const seedsInFirstStage = new Set(plan.progressionRules
      .filter((rule) => rule.source.type === "seed" && plan.contests.find((contest) => contest.ref === rule.target.contestRef)?.stageRef === firstStageRef)
      .map((rule) => rule.source.type === "seed" ? rule.source.seedNumber : -1));
    const byeSeeds = Array.from({ length: entrants }, (_, index) => index + 1).filter((seed) => !seedsInFirstStage.has(seed));
    expect(byeSeeds).toEqual(expectedByeSeeds);
    expect(plan.contests.filter((contest) => contest.stageRef === firstStageRef)).toHaveLength(entrants - 2 ** Math.floor(Math.log2(entrants)));
  });

  it.each([
    [2, [1]], [3, [1, 1]], [4, [2, 1]], [6, [2, 2, 1]], [8, [4, 2, 1]],
  ])("creates only playable contests for %i entrants", (entrants, contestsPerStage) => {
    const plan = planFor(entrants);
    expect(plan.stages.map((stage) => plan.contests.filter((contest) => contest.stageRef === stage.ref).length)).toEqual(contestsPerStage);
    expect(plan.contests).toHaveLength(entrants - 1);
    expect(plan.contests.every((contest) => contest.capacity === 2)).toBe(true);
  });

  it("is deeply deterministic and identity-neutral", () => {
    const first = engine.plan(input(6));
    expect(engine.plan(input(6))).toEqual(first);
    expect(JSON.stringify(first)).not.toMatch(/athlete|team|competitionEntry|name|uuid|createdAt/i);
  });

  it("registers only single elimination in the concrete composition", () => {
    const registry = createCompetitionFormatEngineRegistry();
    expect(registry.resolve("single_elimination")).toMatchObject({ ok: true, value: { supportedKind: "single_elimination" } });
    expect(registry.resolve("round_robin")).toMatchObject({ ok: false, error: { kind: "unsupported_format" } });
    expect(registry.register(engine)).toMatchObject({ ok: false, error: { kind: "duplicate_engine" } });
  });

  it("satisfies all structural invariants for entrant counts 2 through 64", () => {
    for (let entrants = 2; entrants <= 64; entrants += 1) {
      const plan = planFor(entrants);
      const math = singleEliminationBracketMath(entrants);
      expect(math).not.toBeNull();
      if (!math) continue;
      expect((math.bracketSize & (math.bracketSize - 1)) === 0).toBe(true);
      expect(math.bracketSize).toBeGreaterThanOrEqual(entrants);
      expect(plan.contests).toHaveLength(entrants - 1);

      const stageRefs = plan.stages.map((stage) => stage.ref);
      const contestRefs = plan.contests.map((contest) => contest.ref);
      expect(new Set(stageRefs).size).toBe(stageRefs.length);
      expect(new Set(contestRefs).size).toBe(contestRefs.length);
      expect(plan.stages.filter((stage) => stage.ref === "stage:final")).toHaveLength(1);
      expect(plan.contests.filter((contest) => contest.ref === "contest:final")).toHaveLength(1);
      expect(plan.contests.every((contest) => stageRefs.includes(contest.stageRef))).toBe(true);
      expect(plan.progressionRules.every((rule) => contestRefs.includes(rule.target.contestRef))).toBe(true);

      const targets = plan.progressionRules.map((rule) => `${rule.target.contestRef}:${rule.target.position}`);
      expect(new Set(targets).size).toBe(targets.length);
      expect(targets).toHaveLength(plan.contests.length * 2);
      for (const contest of plan.contests) {
        expect(plan.progressionRules.filter((rule) => rule.target.contestRef === contest.ref).map((rule) => rule.target.position).sort()).toEqual([1, 2]);
      }

      const seedNumbers = plan.progressionRules.flatMap((rule) => rule.source.type === "seed" ? [rule.source.seedNumber] : []);
      expect(seedNumbers.sort((a, b) => a - b)).toEqual(Array.from({ length: entrants }, (_, index) => index + 1));
      const winnerSources = plan.progressionRules.flatMap((rule) => rule.source.type === "contest_outcome" ? [rule.source] : []);
      expect(winnerSources.every((source) => source.outcome === "winner" && contestRefs.includes(source.contestRef))).toBe(true);
      expect(winnerSources).toHaveLength(plan.contests.length - 1);
      for (const contest of plan.contests.filter((contest) => contest.ref !== "contest:final")) {
        expect(winnerSources.filter((source) => source.contestRef === contest.ref)).toHaveLength(1);
      }
      expect(winnerSources.some((source) => source.contestRef === "contest:final")).toBe(false);
    }
  });
});
