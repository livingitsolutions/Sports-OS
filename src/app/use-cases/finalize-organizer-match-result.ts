import type { ContestParticipantRepository } from "@app/contracts";
import {
  selectOrganizerMembership,
  type GetOrganizerContext,
  type OrganizerContextError,
} from "@app/use-cases/get-organizer-context";
import type {
  RecordContestResult,
  RecordContestResultError,
} from "@app/use-cases/record-contest-result";
import type { ProgressFinalizedContestResult } from "@app/use-cases/progress-finalized-contest-result";
import type { Result } from "@shared/kernel";

export type FinalizeOrganizerMatchError =
  | OrganizerContextError
  | RecordContestResultError
  | {
      kind: "invalid_participant" | "persistence_unavailable";
      code: string;
      message: string;
    };
export type FinalizeOrganizerMatchValue = {
  contestResultId: string;
  progression: "progressed" | "pending";
};

/** Authenticated organizer facade. The loser and all progression inputs are server-derived. */
export class FinalizeOrganizerMatchResult {
  constructor(
    private readonly d: {
      organizerContext: GetOrganizerContext;
      participants: ContestParticipantRepository;
      record: RecordContestResult;
      progress: ProgressFinalizedContestResult;
    },
  ) {}
  async execute(input: {
    organizationId: string;
    contestId: string;
    winnerContestParticipantId: string;
  }): Promise<
    Result<FinalizeOrganizerMatchValue, FinalizeOrganizerMatchError>
  > {
    const context = await this.d.organizerContext.execute();
    if (!context.ok) return context;
    const selected = selectOrganizerMembership(
      context.value,
      input.organizationId,
    );
    if (!selected.ok) return selected;
    const participants = await this.d.participants.listByContest(
      input.contestId as never,
    );
    if (!participants.ok) return fail("persistence_unavailable");
    if (participants.value.length !== 2)
      return fail(
        "invalid_participant",
        "contest_not_actionable",
        "Contest must have exactly two authoritative participants.",
      );
    const winner = participants.value.find(
        (item) => item.id === input.winnerContestParticipantId,
      ),
      loser = participants.value.find(
        (item) => item.id !== input.winnerContestParticipantId,
      );
    if (!winner || !loser)
      return fail(
        "invalid_participant",
        "participant_not_in_contest",
        "Select an authoritative Contest participant.",
      );
    const recorded = await this.d.record.execute({
      actingMembershipId: selected.value.membershipId,
      contestId: input.contestId,
      winnerContestParticipantId: winner.id,
      loserContestParticipantId: loser.id,
    });
    if (!recorded.ok) return recorded;
    const progressed = await this.d.progress.execute({
      actingMembershipId: selected.value.membershipId,
      contestResultId: recorded.value.result.id,
    });
    return {
      ok: true,
      value: {
        contestResultId: recorded.value.result.id,
        progression: progressed.ok ? "progressed" : "pending",
      },
    };
  }
}
function fail(
  kind: "invalid_participant" | "persistence_unavailable",
  code: string = kind,
  message: string = code,
): Result<never, FinalizeOrganizerMatchError> {
  return { ok: false, error: { kind, code, message } };
}
