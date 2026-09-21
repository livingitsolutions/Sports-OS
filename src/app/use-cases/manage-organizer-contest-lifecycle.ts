import type { ContestRepository } from "@app/contracts";
import { selectOrganizerMembership, type GetOrganizerContext, type OrganizerContextError } from "@app/use-cases/get-organizer-context";
import type { CompleteContest, LifecycleError, ScheduleContest, StartContest } from "@app/use-cases/manage-competition-lifecycle";
import type { ContestStatus } from "@domain/competition/competition.types";
import type { Result } from "@shared/kernel";

export type OrganizerContestLifecycleInput =
  | { organizationId: string; contestId: string; operation: "schedule"; scheduledAt: string }
  | { organizationId: string; contestId: string; operation: "start" | "complete" };
export type OrganizerContestLifecycleError = OrganizerContextError | LifecycleError;

/** Authenticated facade: membership and the optimistic version are server authority. */
export class ManageOrganizerContestLifecycle {
  constructor(private readonly d: {
    organizerContext: GetOrganizerContext;
    contests: ContestRepository;
    schedule: ScheduleContest;
    start: StartContest;
    complete: CompleteContest;
  }) {}

  async execute(input: OrganizerContestLifecycleInput): Promise<Result<{ contestId: string; status: ContestStatus }, OrganizerContestLifecycleError>> {
    const context = await this.d.organizerContext.execute();
    if (!context.ok) return context;
    const selected = selectOrganizerMembership(context.value, input.organizationId);
    if (!selected.ok) return selected;
    const current = await this.d.contests.findById(input.contestId as never);
    if (current.kind === "not_found") return fail("not_found", "Contest does not exist.");
    if (current.kind !== "found") return fail("persistence_unavailable", "Contest lookup failed.");
    const command = {
      actingMembershipId: selected.value.membershipId,
      aggregateId: input.contestId,
      expectedVersion: current.contest.version,
      ...(input.operation === "schedule" ? { scheduledAt: input.scheduledAt } : {}),
    };
    const result = input.operation === "schedule"
      ? await this.d.schedule.execute(command as never)
      : input.operation === "start"
        ? await this.d.start.execute(command)
        : await this.d.complete.execute(command);
    return result.ok
      ? { ok: true, value: { contestId: result.value.contest.id, status: result.value.contest.status } }
      : result;
  }
}

function fail(kind: "not_found" | "persistence_unavailable", message: string): Result<never, LifecycleError> {
  return { ok: false, error: { kind, code: kind, message } };
}
