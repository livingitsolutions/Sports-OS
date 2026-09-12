import type {
  CompetitionFormatEngine,
  CompetitionFormatPlan,
  CompetitionFormatPlanningInput,
  PlannedContest,
  PlannedProgressionRule,
  PlannedStage,
  PlanningError,
  ProgressionSource,
} from "@domain/competition/competition-format-engine";
import type { Result } from "@shared/kernel";

export interface SingleEliminationBracketMath {
  readonly bracketSize: number;
  readonly byeCount: number;
  readonly roundCount: number;
}

const invalidEntrantCount = <T = void>(): Result<T, PlanningError> => ({
  ok: false,
  error: {
    kind: "invalid_input",
    code: "invalid_entrant_count",
    message: "single_elimination requires entrantCount to be an integer of at least 2.",
  },
});

export function singleEliminationBracketMath(entrantCount: number): SingleEliminationBracketMath | null {
  if (!Number.isInteger(entrantCount) || entrantCount < 2) return null;
  const roundCount = Math.ceil(Math.log2(entrantCount));
  const bracketSize = 2 ** roundCount;
  return { bracketSize, byeCount: bracketSize - entrantCount, roundCount };
}

/**
 * Produces the conventional balanced bracket order. Starting with [1, 2],
 * each doubling replaces seed s with [s, newSize + 1 - s]. Adjacent values
 * are first-round opponents, separating the highest seeds across regions.
 */
export function standardSeedPlacement(bracketSize: number): readonly number[] {
  let placement = [1, 2];
  for (let size = 4; size <= bracketSize; size *= 2) {
    placement = placement.flatMap((seed) => [seed, size + 1 - seed]);
  }
  return placement;
}

function stageKey(round: number, roundCount: number): string {
  const remaining = roundCount - round;
  if (remaining === 0) return "final";
  if (remaining === 1) return "semifinal";
  if (remaining === 2) return "quarterfinal";
  return `round_of_${2 ** (remaining + 1)}`;
}

function stageRef(round: number, roundCount: number): string {
  return round === roundCount ? "stage:final" : `stage:r${round}`;
}

function contestRef(round: number, sequence: number, roundCount: number): string {
  return round === roundCount ? "contest:final" : `contest:r${round}:c${sequence}`;
}

export class SingleEliminationEngine implements CompetitionFormatEngine {
  readonly supportedKind = "single_elimination" as const;

  validate(input: CompetitionFormatPlanningInput): Result<void, PlanningError> {
    if (input.formatKind !== this.supportedKind) {
      return { ok: false, error: { kind: "invalid_input", code: "invalid_format_kind", message: "SingleEliminationEngine only plans single_elimination." } };
    }
    return singleEliminationBracketMath(input.entrantCount) ? { ok: true, value: undefined } : invalidEntrantCount();
  }

  plan(input: CompetitionFormatPlanningInput): Result<CompetitionFormatPlan, PlanningError> {
    const validation = this.validate(input);
    if (!validation.ok) return { ok: false, error: validation.error };
    const math = singleEliminationBracketMath(input.entrantCount);
    if (!math) return invalidEntrantCount<CompetitionFormatPlan>();

    const stages: PlannedStage[] = Array.from({ length: math.roundCount }, (_, index) => {
      const round = index + 1;
      return { ref: stageRef(round, math.roundCount), sequence: round, key: stageKey(round, math.roundCount) };
    });
    const contests: PlannedContest[] = [];
    const progressionRules: PlannedProgressionRule[] = [];
    const placement = standardSeedPlacement(math.bracketSize);
    let advancingSources: ProgressionSource[] = [];
    let firstRoundSequence = 0;

    for (let slot = 0; slot < placement.length; slot += 2) {
      const pair = placement.slice(slot, slot + 2).filter((seed) => seed <= input.entrantCount);
      if (pair.length === 1) {
        advancingSources.push({ type: "seed", seedNumber: pair[0]! });
        continue;
      }
      firstRoundSequence += 1;
      const ref = contestRef(1, firstRoundSequence, math.roundCount);
      contests.push({ ref, stageRef: stageRef(1, math.roundCount), sequence: firstRoundSequence, capacity: 2 });
      pair.forEach((seed, index) => progressionRules.push({ source: { type: "seed", seedNumber: seed }, target: { contestRef: ref, position: index + 1 } }));
      advancingSources.push({ type: "contest_outcome", contestRef: ref, outcome: "winner" });
    }

    for (let round = 2; round <= math.roundCount; round += 1) {
      const nextSources: ProgressionSource[] = [];
      for (let index = 0; index < advancingSources.length; index += 2) {
        const sequence = index / 2 + 1;
        const ref = contestRef(round, sequence, math.roundCount);
        contests.push({ ref, stageRef: stageRef(round, math.roundCount), sequence, capacity: 2 });
        progressionRules.push(
          { source: advancingSources[index]!, target: { contestRef: ref, position: 1 } },
          { source: advancingSources[index + 1]!, target: { contestRef: ref, position: 2 } },
        );
        nextSources.push({ type: "contest_outcome", contestRef: ref, outcome: "winner" });
      }
      advancingSources = nextSources;
    }

    return { ok: true, value: { stages, contests, progressionRules } };
  }
}
