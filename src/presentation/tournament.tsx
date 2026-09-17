import type {
  TournamentOperationsPhase,
  TournamentOperationsView,
  TournamentParticipantView,
} from "@app/contracts/tournament-operations-reader";
import { useEffect, useRef, useState } from "react";
import type React from "react";
import type { FinalizeMatchClientResult } from "./client";
import type { OrganizerCommandResult } from "./client";

export const phasePresentation: Record<
  TournamentOperationsPhase,
  { label: string; detail: string; tone: string }
> = {
  setup: {
    label: "Setup",
    detail: "Competition structure is being prepared.",
    tone: "quiet",
  },
  awaiting_seeding: {
    label: "Awaiting seeding",
    detail: "Entrants are ready to be assigned seeds.",
    tone: "attention",
  },
  seeding: {
    label: "Seeding in progress",
    detail: "Seed assignments are being finalized.",
    tone: "attention",
  },
  ready: {
    label: "Ready to compete",
    detail: "The bracket is prepared for match operations.",
    tone: "ready",
  },
  in_progress: {
    label: "In progress",
    detail: "Competition is underway.",
    tone: "live",
  },
  final_pending: {
    label: "Final pending",
    detail: "The final result awaits outcome completion.",
    tone: "attention",
  },
  completed: {
    label: "Completed",
    detail: "The competition outcome is final.",
    tone: "complete",
  },
};
export function shortEntry(id: string) {
  const clean = id.replace(/-/g, "");
  return `Entry •••${clean.slice(-4).toUpperCase()}`;
}
const participantLabel = (p: TournamentParticipantView) =>
  p.sourceSeedNumber
    ? `Seed ${p.sourceSeedNumber}`
    : shortEntry(p.competitionEntryId);
export function StatusBadge({ phase }: { phase: TournamentOperationsPhase }) {
  const p = phasePresentation[phase];
  return (
    <span className={`status status--${p.tone}`}>
      <i aria-hidden="true" />
      {p.label}
    </span>
  );
}
export function EmptyState({
  title = "No tournament selected",
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="empty-state">
      <span className="empty-mark" aria-hidden="true">
        ＋
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
    </section>
  );
}
export function LoadingState() {
  return (
    <section
      className="loading-state"
      aria-label="Loading tournament"
      aria-live="polite"
    >
      <div className="skeleton skeleton--title" />
      <div className="skeleton-grid">
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    </section>
  );
}
export function MessageState({
  kind,
  title,
  children,
}: {
  kind: "error" | "forbidden" | "unsupported";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`message-state message-state--${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      <span aria-hidden="true">{kind === "forbidden" ? "⊘" : "!"}</span>
      <div>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
    </section>
  );
}
function EntryLine({
  participant,
  result,
}: {
  participant?: TournamentParticipantView;
  result?: TournamentOperationsView["contests"][number]["result"];
}) {
  if (!participant)
    return (
      <div className="entry-line entry-line--bye">
        <span>Bye</span>
        <small>No entry assigned</small>
      </div>
    );
  const won =
    result?.winnerCompetitionEntryId === participant.competitionEntryId;
  const lost =
    result?.loserCompetitionEntryId === participant.competitionEntryId;
  return (
    <div
      className={`entry-line ${won ? "is-winner" : ""} ${lost ? "is-loser" : ""}`}
    >
      <span>{participantLabel(participant)}</span>
      <small>
        {participant.sourceSeedNumber
          ? shortEntry(participant.competitionEntryId)
          : participant.sourceOutcome
            ? `Advances as ${participant.sourceOutcome}`
            : "Competition entry"}
      </small>
      {won && <b>Winner</b>}
    </div>
  );
}
export function Bracket({ view }: { view: TournamentOperationsView }) {
  if (view.formatKind !== "single_elimination")
    return (
      <MessageState kind="unsupported" title="Bracket preview unavailable">
        This workspace only visualizes supported Single Elimination
        competitions.
      </MessageState>
    );
  if (!view.stages.length)
    return (
      <EmptyState title="Bracket not materialized">
        Stages and matches appear after the competition structure is prepared.
      </EmptyState>
    );
  return (
    <div
      className="bracket-wrap"
      tabIndex={0}
      aria-label="Single Elimination bracket; scroll horizontally to review stages"
    >
      <div className="bracket">
        {view.stages.map((stage) => (
          <section
            className="round"
            key={stage.stageId}
            aria-labelledby={`stage-${stage.stageId}`}
          >
            <header>
              <span>Competition stage</span>
              <h3 id={`stage-${stage.stageId}`}>Stage {stage.sequence}</h3>
              <small>
                {stage.contests.length}{" "}
                {stage.contests.length === 1 ? "match" : "matches"}
              </small>
            </header>
            <div className="round-matches">
              {stage.contests.map((contest) => (
                <article className="match-card" key={contest.contestId}>
                  <div className="match-meta">
                    <span>Match {contest.sequence}</span>
                    <span>{contest.result ? "Final" : "Pending"}</span>
                  </div>
                  <EntryLine
                    participant={contest.participants.find(
                      (p) => p.position === 1,
                    )}
                    result={contest.result}
                  />
                  <EntryLine
                    participant={contest.participants.find(
                      (p) => p.position === 2,
                    )}
                    result={contest.result}
                  />
                  <footer>
                    {contest.progressionState.replaceAll("_", " ")}
                  </footer>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
export type WorkspaceTab =
  | "overview"
  | "seeding"
  | "bracket"
  | "matches"
  | "results";
export function TournamentWorkspace({
  view,
  tab,
  onTab,
  onFinalize,
  onRetryProgression,
  onFinalizeOutcome,
}: {
  view: TournamentOperationsView;
  tab: WorkspaceTab;
  onTab: (tab: WorkspaceTab) => void;
  onFinalize?: (
    contestId: string,
    winnerContestParticipantId: string,
  ) => Promise<FinalizeMatchClientResult>;
  onRetryProgression?: (contestResultId: string) => Promise<OrganizerCommandResult>;
  onFinalizeOutcome?: () => Promise<OrganizerCommandResult>;
}) {
  const phase = phasePresentation[view.phase];
  const tabs: WorkspaceTab[] = [
    "overview",
    "seeding",
    "bracket",
    "matches",
    "results",
  ];
  return (
    <div className="workspace">
      <header className="workspace-head">
        <div>
          <p className="eyebrow">Tournament workspace</p>
          <h1>
            Competition <span>{shortEntry(view.competitionId).slice(-7)}</span>
          </h1>
          <p>Sport-neutral · Single Elimination</p>
        </div>
        <div className="phase-block">
          <StatusBadge phase={view.phase} />
          <small>{phase.detail}</small>
        </div>
      </header>
      <nav className="tabs" aria-label="Tournament workspace">
        {tabs.map((item) => (
          <button
            key={item}
            className={tab === item ? "active" : ""}
            aria-current={tab === item ? "page" : undefined}
            onClick={() => onTab(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      {tab === "overview" && <Overview view={view} onFinalizeOutcome={onFinalizeOutcome} />}{" "}
      {tab === "seeding" && <Seeding view={view} />}{" "}
      {tab === "bracket" && <Bracket view={view} />}{" "}
      {tab === "matches" && <Matches view={view} onFinalize={onFinalize} onRetryProgression={onRetryProgression} />}{" "}
      {tab === "results" && <Results view={view} />}
    </div>
  );
}
function Overview({view,onFinalizeOutcome}:{view:TournamentOperationsView;onFinalizeOutcome?:()=>Promise<OrganizerCommandResult>}) {
  const next = view.contests.find((c) => !c.result);
  const [pending,setPending]=useState(false),[feedback,setFeedback]=useState<OrganizerCommandResult>();
  return (
    <div className="overview-grid">
      <section className="feature-panel">
        <p className="eyebrow">Operations pulse</p>
        <h2>{phasePresentation[view.phase].label}</h2>
        <p>{phasePresentation[view.phase].detail}</p>
        <div className="progress">
          <span
            style={{
              width: `${view.contests.length ? Math.round((view.contests.filter((c) => c.result).length / view.contests.length) * 100) : 0}%`,
            }}
          />
        </div>
        <small>
          {view.contests.filter((c) => c.result).length} of{" "}
          {view.contests.length} matches finalized
        </small>
        {view.phase === "final_pending" && <div className="outcome-action"><p>The Final is authoritative. Complete the outcome to publish Champion and finalist placements.</p><button className="finalize-button" disabled={pending||!onFinalizeOutcome} onClick={()=>{setPending(true);void onFinalizeOutcome?.().then(result=>{setFeedback(result);setPending(false);});}}>{pending?"Completing…":"Complete tournament outcome"}</button>{feedback&&feedback.kind!=="completed"&&<p className="operation-feedback error" role="alert">Outcome completion is unavailable. The Final result remains safe.</p>}</div>}
      </section>
      <section className="stat-stack">
        <article>
          <span>Entrants</span>
          <b>{view.entrantCount ?? "—"}</b>
          <small>{view.seeding.assignedCount} seeded</small>
        </article>
        <article>
          <span>Structure</span>
          <b>{view.stages.length}</b>
          <small>stages · {view.contests.length} matches</small>
        </article>
      </section>
      <section className="next-panel">
        <p className="eyebrow">Next operation</p>
        <h3>{next ? `Match ${next.sequence}` : "No pending matches"}</h3>
        <p>
          {next
            ? `Stage ${view.stages.find((s) => s.stageId === next.stageId)?.sequence ?? "—"} · ${next.participants.length} entries assigned`
            : "All materialized matches have finalized results."}
        </p>
      </section>
    </div>
  );
}
function Seeding({ view }: { view: TournamentOperationsView }) {
  return (
    <section className="data-panel">
      <header>
        <div>
          <p className="eyebrow">Entry order</p>
          <h2>Seeding</h2>
        </div>
        <span>{view.seeding.finalized ? "Finalized" : "Working order"}</span>
      </header>
      {view.seeding.assignments.length ? (
        <ol className="seed-list">
          {[...view.seeding.assignments]
            .sort((a, b) => a.seedNumber - b.seedNumber)
            .map((a) => (
              <li key={a.competitionEntryId}>
                <b>{a.seedNumber}</b>
                <span>
                  Seed {a.seedNumber}
                  <small>{shortEntry(a.competitionEntryId)}</small>
                </span>
              </li>
            ))}
        </ol>
      ) : (
        <EmptyState title="No seeds assigned">
          Seed assignments appear here from the authoritative competition view.
        </EmptyState>
      )}
    </section>
  );
}
export function contestOperationState(
  c: TournamentOperationsView["contests"][number],
) {
  if (c.result)
    return c.progressionState === "awaiting_progression"
      ? "Awaiting progression"
      : c.progressionState === "terminal_progressed"
        ? "Terminal progressed"
        : "Progressed";
  if (c.status === "cancelled") return "Not applicable";
  if (c.participants.length !== 2) return "Awaiting participants";
  if (c.progressionState === "awaiting_result") return "Action required";
  if (c.progressionState === "awaiting_progression")
    return "Awaiting progression";
  if (c.progressionState === "terminal_progressed")
    return "Terminal progressed";
  if (c.progressionState === "progressed") return "Progressed";
  return "Not applicable";
}
export function isContestActionable(
  c: TournamentOperationsView["contests"][number],
) {
  return (
    !c.result &&
    c.status !== "cancelled" &&
    c.participants.length === 2 &&
    c.progressionState === "awaiting_result"
  );
}
function Matches({
  view,
  onFinalize,
  onRetryProgression,
}: {
  view: TournamentOperationsView;
  onFinalize?: (
    contestId: string,
    winnerContestParticipantId: string,
  ) => Promise<FinalizeMatchClientResult>;
  onRetryProgression?: (contestResultId: string) => Promise<OrganizerCommandResult>;
}) {
  const [open, setOpen] =
      useState<TournamentOperationsView["contests"][number]>(),
    [winner, setWinner] = useState(""),
    [confirm, setConfirm] = useState(false),
    [pending, setPending] = useState(false),
    [feedback, setFeedback] = useState<FinalizeMatchClientResult>();
  const [retrying,setRetrying]=useState<string>();
  const closeButton=useRef<React.ElementRef<"button">>(null);
  useEffect(()=>{if(open)closeButton.current?.focus();},[open]);
  const submit = async () => {
    if (!open || !winner || !confirm || !onFinalize) return;
    setPending(true);
    const result = await onFinalize(open.contestId, winner);
    setPending(false);
    setFeedback(result);
    if (result.kind === "progressed") setOpen(undefined);
  };
  return (
    <section className="data-panel">
      <header>
        <div>
          <p className="eyebrow">Match operations</p>
          <h2>Matches</h2>
        </div>
        <span>{view.contests.length} total</span>
      </header>
      <div className="match-list">
        {view.contests.map((c) => (
          <article
            key={c.contestId}
            className={isContestActionable(c) ? "is-actionable" : ""}
          >
            <div>
              <b>Match {c.sequence}</b>
              <small>
                Stage{" "}
                {view.stages.find((s) => s.stageId === c.stageId)?.sequence}
              </small>
            </div>
            <span>
              {c.participants.map(participantLabel).join(" · ") ||
                "No participants assigned"}
            </span>
            {isContestActionable(c) ? (
              <button
                className="operate-button"
                onClick={() => {
                  setOpen(c);
                  setWinner("");
                  setConfirm(false);
                  setFeedback(undefined);
                }}
              >
                Enter result
              </button>
            ) : c.result && c.progressionState === "awaiting_progression" ? (
              <button className="secondary-button" disabled={retrying===c.result.contestResultId||!onRetryProgression} onClick={()=>{setRetrying(c.result!.contestResultId);void onRetryProgression?.(c.result!.contestResultId).finally(()=>setRetrying(undefined));}}>{retrying===c.result.contestResultId?"Retrying…":"Retry progression"}</button>
            ) : (
              <small className="mini-status">{contestOperationState(c)}</small>
            )}
          </article>
        ))}
      </div>
      {open && (
        <div className="operation-backdrop">
          <section
            className="operation-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="operation-title"
            onKeyDown={event=>{if(event.key==="Escape"&&!pending)setOpen(undefined);}}
          >
            <header>
              <div>
                <p className="eyebrow">
                  Stage{" "}
                  {
                    view.stages.find((s) => s.stageId === open.stageId)
                      ?.sequence
                  }{" "}
                  · Match {open.sequence}
                </p>
                <h2 id="operation-title">Finalize match result</h2>
              </div>
              <button
                ref={closeButton}
                aria-label="Close result operation"
                disabled={pending}
                onClick={() => setOpen(undefined)}
              >
                ×
              </button>
            </header>
            <p className="authority-note">
              Choose the winner from the authoritative match participants. This
              result becomes official and cannot be edited here.
            </p>
            <fieldset disabled={pending}>
              <legend>Match winner</legend>
              {open.participants.map((p) => (
                <label
                  className={
                    winner === p.contestParticipantId
                      ? "winner-choice selected"
                      : "winner-choice"
                  }
                  key={p.contestParticipantId}
                >
                  <input
                    type="radio"
                    name="winner"
                    checked={winner === p.contestParticipantId}
                    onChange={() => setWinner(p.contestParticipantId)}
                  />
                  <span>
                    <b>{participantLabel(p)}</b>
                    <small>
                      {shortEntry(p.competitionEntryId)} · Position {p.position}
                    </small>
                  </span>
                </label>
              ))}
            </fieldset>
            <label className="confirm-check">
              <input
                type="checkbox"
                checked={confirm}
                disabled={pending}
                onChange={(e) => setConfirm(e.target.checked)}
              />
              <span>
                I confirm this winner and understand the result becomes
                authoritative.
              </span>
            </label>
            {feedback && feedback.kind !== "progressed" && (
              <div
                className={`operation-feedback ${feedback.kind === "progression_pending" ? "warning" : "error"}`}
                role="alert"
              >
                {feedback.kind === "progression_pending"
                  ? "The result is authoritative, but bracket progression is still pending. The refreshed workspace shows its current state."
                  : feedback.kind === "conflict"
                    ? "Another authoritative result already exists. The workspace has refreshed."
                    : feedback.kind === "forbidden"
                      ? "Your active organizer membership cannot finalize this result."
                      : feedback.kind === "invalid"
                        ? "This match is no longer actionable or the participant is invalid."
                        : feedback.kind === "unauthenticated"
                          ? "Your session has ended. Sign in again."
                          : "The result operation is temporarily unavailable. Try again."}
              </div>
            )}
            <footer>
              <button
                className="secondary-button"
                disabled={pending}
                onClick={() => setOpen(undefined)}
              >
                Cancel
              </button>
              <button
                className="finalize-button"
                disabled={!winner || !confirm || pending}
                onClick={() => void submit()}
              >
                {pending ? "Finalizing…" : "Finalize authoritative result"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
function Results({ view }: { view: TournamentOperationsView }) {
  if (!view.outcome)
    return (
      <EmptyState title="Outcome not finalized">
        Final placements appear after competition outcome completion.
      </EmptyState>
    );
  return (
    <section className="results-panel">
      <p className="eyebrow">Final outcome</p>
      <h2>Official placements</h2>
      <ol>
        {[...view.outcome.placements]
          .sort((a, b) => a.position - b.position)
          .map((p) => (
            <li key={p.competitionEntryId}>
              <b>{String(p.position).padStart(2, "0")}</b>
              <span>
                {p.position === 1 ? "Champion" : "Finalist · second place"}
                <small>{shortEntry(p.competitionEntryId)}</small>
              </span>
            </li>
          ))}
      </ol>
    </section>
  );
}
