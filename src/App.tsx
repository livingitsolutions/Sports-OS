/* global URL */
import { useEffect, useState } from "react";
import type React from "react";
import type { OrganizerOrganizationContext } from "./app/use-cases/get-organizer-context";
import {
  EmptyState,
  LoadingState,
  MessageState,
  TournamentWorkspace,
  type WorkspaceTab,
} from "./presentation/tournament";
import {
  finalizeOrganizerMatch,
  retryOrganizerProgression,
  finalizeOrganizerOutcome,
  loadOrganizerWorkspace,
  type OrganizerLoadResult,
} from "./presentation/client";
const nav = [
  { label: "Overview", icon: "grid", available: true },
  { label: "Tournaments", icon: "flag", available: true },
  { label: "Teams", icon: "people", available: false },
  { label: "Athletes", icon: "person", available: false },
  { label: "Matches", icon: "whistle", available: false },
];
function Mark({ name }: { name: string }) {
  return <span className={`nav-icon nav-icon--${name}`} aria-hidden="true" />;
}
function OrganizationPicker({
  organizations,
  selected,
  onSelect,
}: {
  organizations: readonly OrganizerOrganizationContext[];
  selected?: string;
  onSelect?: (id: string) => void;
}) {
  const current = organizations.find(
    (item) => item.organizationId === selected,
  );
  if (organizations.length < 2)
    return (
      <div className="org-switch">
        <small>Organization</small>
        <strong>{current?.organizationName ?? "Organizer workspace"}</strong>
        <i aria-hidden="true">PH</i>
      </div>
    );
  return (
    <label className="org-switch org-switch--select">
      <small>Organization</small>
      <select
        aria-label="Organization context"
        value={selected}
        onChange={(event) => onSelect?.(event.target.value)}
      >
        {organizations.map((item) => (
          <option key={item.organizationId} value={item.organizationId}>
            {item.organizationName}
          </option>
        ))}
      </select>
      <i aria-hidden="true">PH</i>
    </label>
  );
}
export function AppShell({
  children,
  organizations = [],
  selectedOrganizationId,
  onOrganizationChange,
}: {
  children: React.ReactNode;
  organizations?: readonly OrganizerOrganizationContext[];
  selectedOrganizationId?: string;
  onOrganizationChange?: (id: string) => void;
}) {
  const name =
    organizations.find((item) => item.organizationId === selectedOrganizationId)
      ?.organizationName ?? "Organizer workspace";
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="SportsOS home">
          <span>S</span>
          <b>
            SPORTS<em>OS</em>
          </b>
        </a>
        <OrganizationPicker
          organizations={organizations}
          selected={selectedOrganizationId}
          onSelect={onOrganizationChange}
        />
        <nav aria-label="Primary">
          <p>Compete</p>
          {nav.map((item) => (
            <a
              key={item.label}
              href={item.available ? "#workspace" : undefined}
              className={
                !item.available
                  ? "disabled"
                  : item.label === "Tournaments"
                    ? "active"
                    : ""
              }
              aria-disabled={!item.available}
            >
              <Mark name={item.icon} />
              <span>{item.label}</span>
              {!item.available && <small>Later</small>}
            </a>
          ))}
        </nav>
        <footer>
          <span>OS</span>
          <div>
            <b>Organizer</b>
            <small>Operations access</small>
          </div>
        </footer>
      </aside>
      <main className="main">
        <header className="mobile-top">
          <a className="brand" href="/">
            <span>S</span>
            <b>
              SPORTS<em>OS</em>
            </b>
          </a>
          <div>
            <small>{name}</small>
            <i>PH</i>
          </div>
        </header>
        {children}
      </main>
      <nav className="mobile-nav" aria-label="Mobile primary navigation">
        {nav.slice(0, 3).map((item) => (
          <a
            key={item.label}
            href={item.available ? "#workspace" : undefined}
            aria-disabled={!item.available}
            className={
              item.label === "Tournaments"
                ? "active"
                : !item.available
                  ? "disabled"
                  : ""
            }
          >
            <Mark name={item.icon} />
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
const contextOf = (state: OrganizerLoadResult) =>
  "context" in state ? state.context : undefined;
const selectedOf = (state: OrganizerLoadResult) =>
  "selected" in state ? state.selected : undefined;
export default function App() {
  const [state, setState] = useState<OrganizerLoadResult>(),
    [tab, setTab] = useState<WorkspaceTab>("overview");
  useEffect(() => {
    void loadOrganizerWorkspace().then(setState);
  }, []);
  const context = state && contextOf(state),
    selected = state && selectedOf(state);
  const changeOrganization = (organizationId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("organizationId", organizationId);
    window.history.replaceState(null, "", url);
    setState(undefined);
    void loadOrganizerWorkspace(organizationId).then(setState);
  };
  const workspace =
    state?.kind === "ready" && state.view
      ? { ...state, view: state.view }
      : undefined;
  return (
    <AppShell
      organizations={context?.organizations}
      selectedOrganizationId={selected?.organizationId}
      onOrganizationChange={changeOrganization}
    >
      <div className="page" id="workspace">
        <header className="page-intro">
          <div>
            <p className="eyebrow">Competition control</p>
            <h1>Organizer overview</h1>
            <p>Read the field. Move the tournament forward.</p>
          </div>
          <time>
            {new Intl.DateTimeFormat("en-PH", {
              weekday: "short",
              day: "numeric",
              month: "short",
            }).format(new Date())}
          </time>
        </header>
        {workspace ? (
          <TournamentWorkspace
            view={workspace.view}
            tab={tab}
            onTab={setTab}
            onFinalize={async (contestId, winnerContestParticipantId) => {
              const result = await finalizeOrganizerMatch({
                organizationId: workspace.selected.organizationId,
                contestId,
                winnerContestParticipantId,
              });
              setState(
                await loadOrganizerWorkspace(workspace.selected.organizationId),
              );
              return result;
            }}
            onRetryProgression={async contestResultId=>{const result=await retryOrganizerProgression({organizationId:workspace.selected.organizationId,contestResultId});setState(await loadOrganizerWorkspace(workspace.selected.organizationId));return result;}}
            onFinalizeOutcome={async()=>{const result=await finalizeOrganizerOutcome({organizationId:workspace.selected.organizationId,competitionFormatId:workspace.view.competitionFormatId});setState(await loadOrganizerWorkspace(workspace.selected.organizationId));return result;}}
          />
        ) : !state ? (
          <LoadingState />
        ) : state.kind === "ready" ? (
          <EmptyState>
            Select a tournament from this organization to open its live
            operations workspace.
          </EmptyState>
        ) : state.kind === "unauthenticated" ? (
          <MessageState kind="forbidden" title="Sign in required">
            Sign in with your SportsOS account to open the organizer workspace.
          </MessageState>
        ) : state.kind === "no_memberships" ? (
          <EmptyState title="No organizer organizations">
            Your account has no active organization memberships.
          </EmptyState>
        ) : state.kind === "organization_unavailable" ? (
          <MessageState kind="forbidden" title="Organization unavailable">
            The selected organization is not available to your active
            memberships.
          </MessageState>
        ) : state.kind === "forbidden" ? (
          <MessageState kind="forbidden" title="Access not available">
            Your organizer membership does not have permission to view this
            tournament.
          </MessageState>
        ) : state.kind === "unsupported" ? (
          <MessageState kind="unsupported" title="Format not supported here">
            This operations workspace currently supports Single Elimination
            only.
          </MessageState>
        ) : (
          <MessageState kind="error" title="Organizer workspace unavailable">
            We couldn’t load your organizer context. Try again in a moment.
          </MessageState>
        )}
      </div>
    </AppShell>
  );
}
