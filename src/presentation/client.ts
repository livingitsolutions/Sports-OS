import { createClient } from "@supabase/supabase-js";
import type {
  OrganizerContext,
  OrganizerOrganizationContext,
} from "@app/use-cases/get-organizer-context";
import type { TournamentOperationsView } from "@app/contracts/tournament-operations-reader";
export type OrganizerLoadResult =
  | {
      kind: "ready";
      context: OrganizerContext;
      selected: OrganizerOrganizationContext;
      view?: TournamentOperationsView;
    }
  | { kind: "unauthenticated" }
  | { kind: "no_memberships"; context: OrganizerContext }
  | { kind: "organization_unavailable"; context: OrganizerContext }
  | {
      kind: "forbidden";
      context: OrganizerContext;
      selected: OrganizerOrganizationContext;
    }
  | {
      kind: "unsupported";
      context: OrganizerContext;
      selected: OrganizerOrganizationContext;
    }
  | { kind: "error" };
export async function loadOrganizerWorkspace(
  organizationOverride?: string,
): Promise<OrganizerLoadResult> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined,
    key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url?.trim() || !key?.trim()) return { kind: "error" };
  const supabase = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }),
    session = await supabase.auth.getSession(),
    token = session.data.session?.access_token;
  if (!token) return { kind: "unauthenticated" };
  const headers = { Authorization: `Bearer ${token}` };
  try {
    const response = await window.fetch(
      "/.netlify/functions/organizer-context",
      { headers },
    );
    if (response.status === 401) return { kind: "unauthenticated" };
    if (!response.ok) return { kind: "error" };
    const context = (await response.json()) as OrganizerContext;
    if (context.organizations.length === 0)
      return { kind: "no_memberships", context };
    const query = new window.URLSearchParams(window.location.search),
      requested = organizationOverride ?? query.get("organizationId"),
      selected = requested
        ? context.organizations.find(
            (item) => item.organizationId === requested,
          )
        : context.organizations[0];
    if (!selected) return { kind: "organization_unavailable", context };
    const format = query.get("competitionFormatId");
    if (!format) return { kind: "ready", context, selected };
    const tournament = await window.fetch(
      `/.netlify/functions/tournament-operations?competitionFormatId=${encodeURIComponent(format)}&organizationId=${encodeURIComponent(selected.organizationId)}`,
      { headers },
    );
    if (tournament.status === 401) return { kind: "unauthenticated" };
    if (tournament.status === 403)
      return { kind: "forbidden", context, selected };
    if (tournament.status === 422)
      return { kind: "unsupported", context, selected };
    if (!tournament.ok) return { kind: "error" };
    return {
      kind: "ready",
      context,
      selected,
      view: (await tournament.json()) as TournamentOperationsView,
    };
  } catch {
    return { kind: "error" };
  }
}

export type FinalizeMatchClientResult =
  | { kind: "progressed" | "progression_pending" }
  | {
      kind:
        | "unauthenticated"
        | "forbidden"
        | "conflict"
        | "invalid"
        | "unavailable";
    };
export async function finalizeOrganizerMatch(input: {
  organizationId: string;
  contestId: string;
  winnerContestParticipantId: string;
}): Promise<FinalizeMatchClientResult> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined,
    key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url?.trim() || !key?.trim()) return { kind: "unavailable" };
  const session = await createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }).auth.getSession(),
    token = session.data.session?.access_token;
  if (!token) return { kind: "unauthenticated" };
  try {
    const response = await window.fetch(
      "/.netlify/functions/finalize-organizer-match",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      },
    );
    if (response.ok) {
      const body = (await response.json()) as {
        progression: "progressed" | "pending";
      };
      return {
        kind:
          body.progression === "progressed"
            ? "progressed"
            : "progression_pending",
      };
    }
    return {
      kind:
        response.status === 401
          ? "unauthenticated"
          : response.status === 403
            ? "forbidden"
            : response.status === 409
              ? "conflict"
              : response.status === 400 || response.status === 422
                ? "invalid"
                : "unavailable",
    };
  } catch {
    return { kind: "unavailable" };
  }
}
