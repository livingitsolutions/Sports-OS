import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TournamentOperationsView } from "@app/contracts/tournament-operations-reader";
import { AppShell } from "../../src/App";
import {
  Bracket,
  EmptyState,
  LoadingState,
  MessageState,
  TournamentWorkspace,
  contestOperationState,
  isContestActionable,
  contestLifecycleOperation,
  phasePresentation,
  shortEntry,
} from "../../src/presentation/tournament";

const view: TournamentOperationsView = {
  competitionFormatId: "format-1",
  competitionId: "competition-1234abcd",
  eventId: "event-1",
  organizationId: "org-1",
  sportId: "sport-neutral",
  formatKind: "single_elimination",
  competitionStatus: "active",
  formatStatus: "active",
  phase: "completed",
  entrantCount: 3,
  seeding: {
    frozenEntrantCount: 3,
    finalized: true,
    assignedCount: 3,
    assignments: [
      { seedNumber: 1, competitionEntryId: "entry-1111" },
      { seedNumber: 2, competitionEntryId: "entry-2222" },
      { seedNumber: 3, competitionEntryId: "entry-3333" },
    ],
  },
  stages: [
    {
      stageId: "s1",
      sequence: 1,
      status: "active",
      contests: [
        {
          contestId: "c1",
          planRef: "r1",
          stageId: "s1",
          sequence: 1,
          status: "completed",
          capacity: 2,
          participants: [
            {
              contestParticipantId: "p1",
              position: 1,
              competitionEntryId: "entry-1111",
              sourceType: "seed",
              sourceSeedNumber: 1,
            },
          ],
          progressionState: "progressed",
        },
      ],
    },
    {
      stageId: "s2",
      sequence: 2,
      status: "active",
      contests: [
        {
          contestId: "c2",
          planRef: "r2",
          stageId: "s2",
          sequence: 2,
          status: "completed",
          capacity: 2,
          participants: [
            {
              contestParticipantId: "p2",
              position: 1,
              competitionEntryId: "entry-1111",
              sourceType: "contest_outcome",
              sourceOutcome: "winner",
              sourceContestResultId: "result-1",
            },
            {
              contestParticipantId: "p3",
              position: 2,
              competitionEntryId: "entry-2222",
              sourceType: "seed",
              sourceSeedNumber: 2,
            },
          ],
          result: {
            contestResultId: "result-2",
            status: "finalized",
            finalizedAt: "2026-09-16",
            winnerCompetitionEntryId: "entry-1111",
            loserCompetitionEntryId: "entry-2222",
            progressionConsumed: true,
          },
          progressionState: "terminal_progressed",
        },
      ],
    },
  ],
  contests: [],
  outcome: {
    competitionOutcomeId: "outcome-1",
    finalizedAt: "2026-09-16",
    placements: [
      {
        position: 1,
        competitionEntryId: "entry-1111",
        sourceContestResultId: "result-2",
      },
      {
        position: 2,
        competitionEntryId: "entry-2222",
        sourceContestResultId: "result-2",
      },
    ],
  },
};
view.contests = view.stages.flatMap((stage) => stage.contests);
const html = (element: React.ReactElement) => renderToStaticMarkup(element);
describe("organizer interface", () => {
  it("renders the application shell and honest navigation", () => {
    const output = html(React.createElement(AppShell, null, "content"));
    expect(output).toContain("Organizer workspace");
    expect(output).toContain("Mobile primary navigation");
    expect(output).toContain("Later");
  });
  it("presents every authoritative phase", () => {
    expect(Object.keys(phasePresentation)).toEqual([
      "setup",
      "awaiting_seeding",
      "seeding",
      "ready",
      "in_progress",
      "final_pending",
      "completed",
    ]);
    expect(phasePresentation.final_pending.label).toBe("Final pending");
  });
  it("renders seeding and structural identities", () => {
    const output = html(
      React.createElement(TournamentWorkspace, {
        view,
        tab: "seeding",
        onTab: () => undefined,
      }),
    );
    expect(output).toContain("Seed 1");
    expect(output).toContain("Entry •••1111");
  });
  it("renders bracket byes and finalized winners", () => {
    const output = html(React.createElement(Bracket, { view }));
    expect(output).toContain("Bye");
    expect(output).toContain("No entry assigned");
    expect(output).toContain("Winner");
    expect(output).toContain("terminal progressed");
  });
  it("renders completed placements", () => {
    const output = html(
      React.createElement(TournamentWorkspace, {
        view,
        tab: "results",
        onTab: () => undefined,
      }),
    );
    expect(output).toContain("Champion");
    expect(output).toContain("Official placements");
  });
  it("renders loading, empty, error, forbidden, and unsupported states", () => {
    expect(html(React.createElement(LoadingState))).toContain(
      "Loading tournament",
    );
    expect(html(React.createElement(EmptyState, null, "Empty"))).toContain(
      "Empty",
    );
    expect(
      html(
        React.createElement(
          MessageState,
          { kind: "error", title: "Error" },
          "Safe message",
        ),
      ),
    ).toContain('role="alert"');
    expect(
      html(
        React.createElement(
          MessageState,
          { kind: "forbidden", title: "Forbidden" },
          "No access",
        ),
      ),
    ).toContain("Forbidden");
    expect(
      html(
        React.createElement(
          MessageState,
          { kind: "unsupported", title: "Unsupported" },
          "Format",
        ),
      ),
    ).toContain("Unsupported");
  });
  it("obscures long identifiers", () =>
    expect(shortEntry("12345678-abcd-ef00-9999-123456789abc")).toBe(
      "Entry •••9ABC",
    ));
});

describe("match operations presentation authority", () => {
  const readyParticipants = [
    {
      contestParticipantId: "p1",
      position: 1,
      competitionEntryId: "entry-1111",
      sourceType: "seed" as const,
      sourceSeedNumber: 1,
    },
    {
      contestParticipantId: "p2",
      position: 2,
      competitionEntryId: "entry-2222",
      sourceType: "seed" as const,
      sourceSeedNumber: 2,
    },
  ];
  const readyContest = {
    ...view.contests[0]!,
    status: "pending" as const,
    participants: readyParticipants,
    progressionState: "awaiting_result" as const,
    result: undefined,
  };

  it("renders a pending two-participant contest as schedulable, not result actionable", () => {
    const contest = {
      ...view.contests[0]!,
      ...readyContest,
    };
    const actionable = {
      ...view,
      contests: [contest],
      stages: [{ ...view.stages[0]!, contests: [contest] }],
    };
    const output = html(
      React.createElement(TournamentWorkspace, {
        view: actionable,
        tab: "matches",
        onTab: () => undefined,
        onFinalize: async () => ({ kind: "progressed" }),
      }),
    );
    expect(output).toContain("Schedule");
    expect(output).not.toContain("Enter result");
    expect(output).not.toContain("Finalize match result");
  });

  it("uses authoritative progression state for actionability", () => {
    expect(isContestActionable(readyContest)).toBe(false);
    expect(contestLifecycleOperation(readyContest)).toBe("schedule");
    expect(contestLifecycleOperation({...readyContest,status:"scheduled"})).toBe("start");
    expect(contestLifecycleOperation({...readyContest,status:"in_progress"})).toBe("complete");
    expect(contestLifecycleOperation({...readyContest,progressionState:"progressed"})).toBeUndefined();
    expect(contestLifecycleOperation({...readyContest,progressionState:"terminal_progressed"})).toBeUndefined();
    expect(isContestActionable({...readyContest,status:"completed"})).toBe(true);
    expect(
      isContestActionable({ ...readyContest, participants: [readyParticipants[0]!] }),
    ).toBe(false);
    expect(
      isContestActionable({ ...readyContest, result: view.contests[1]!.result }),
    ).toBe(false);
    expect(
      isContestActionable({ ...readyContest, progressionState: "awaiting_progression" }),
    ).toBe(false);
    expect(
      isContestActionable({ ...readyContest, progressionState: "terminal_progressed" }),
    ).toBe(false);
    expect(
      isContestActionable({ ...readyContest, status: "cancelled" }),
    ).toBe(false);
  });

  it("presents non-actionable lifecycle states", () => {
    expect(contestOperationState({ ...readyContest, participants: [] })).toBe(
      "Awaiting participants",
    );
    expect(
      contestOperationState({ ...readyContest, progressionState: "awaiting_progression" }),
    ).toBe("Awaiting progression");
    expect(
      contestOperationState({ ...readyContest, progressionState: "terminal_progressed" }),
    ).toBe("Terminal progressed");
    expect(contestOperationState({ ...readyContest, status: "cancelled" })).toBe(
      "Not applicable",
    );
  });
});
