/* global Response, URLSearchParams */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth })),
}));

import { OrganizerSignIn } from "../../src/App";
import {
  finalizeOrganizerMatch,
  loadOrganizerWorkspace,
  signInOrganizer,
  signOutOrganizer,
} from "../../src/presentation/client";

const context = {
  personId: "person-1",
  organizations: [
    {
      organizationId: "org-1",
      membershipId: "membership-1",
      organizationName: "Pilot League",
    },
  ],
};

describe("organizer browser authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "public-anon-key");
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          search: "",
          href: "https://sports.test/",
        },
        URLSearchParams,
        fetch: vi.fn(),
      },
    });
  });

  it("renders an accessible unauthenticated sign-in form without a password value", () => {
    const output = renderToStaticMarkup(
      React.createElement(OrganizerSignIn, { onAuthenticated: vi.fn() }),
    );
    expect(output).toContain("Sign in required");
    expect(output).toContain('type="email"');
    expect(output).toContain('type="password"');
    expect(output).toContain('for="organizer-password"');
    expect(output).not.toContain("pilot-password");
  });

  it("signs in and then resolves authorization through Organizer Context", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    auth.getSession.mockResolvedValue({
      data: { session: { access_token: "browser-access-token" } },
    });
    vi.mocked(window.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(context), { status: 200 }),
    );

    expect(await signInOrganizer("organizer@example.test", "pilot-password")).toEqual({
      kind: "authenticated",
    });
    expect(await loadOrganizerWorkspace()).toMatchObject({
      kind: "ready",
      selected: { organizationId: "org-1" },
    });
    expect(window.fetch).toHaveBeenCalledWith(
      "/.netlify/functions/organizer-context",
      expect.any(Object),
    );
  });

  it("keeps invalid credentials unauthenticated and does not log the password", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { status: 400, message: "Invalid login credentials" },
    });
    expect(await signInOrganizer("organizer@example.test", "pilot-password")).toEqual({
      kind: "invalid_credentials",
    });
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("signs out through the shared browser client", async () => {
    auth.signOut.mockResolvedValue({ error: null });
    await signOutOrganizer();
    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it("preserves organization and tournament query parameters during login resolution", async () => {
    window.location.search =
      "?organizationId=org-1&competitionFormatId=format-1";
    auth.getSession.mockResolvedValue({
      data: { session: { access_token: "browser-access-token" } },
    });
    vi.mocked(window.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(context), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ competitionFormatId: "format-1" }), {
          status: 200,
        }),
      );
    const result = await loadOrganizerWorkspace();
    expect(result).toMatchObject({ kind: "ready", view: { competitionFormatId: "format-1" } });
    expect(window.fetch).toHaveBeenLastCalledWith(
      "/.netlify/functions/tournament-operations?competitionFormatId=format-1&organizationId=org-1",
      expect.any(Object),
    );
    expect(window.location.search).toBe(
      "?organizationId=org-1&competitionFormatId=format-1",
    );
  });

  it("submits the authoritative ContestParticipant ID for a result command", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "browser-access-token" } } });
    vi.mocked(window.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ progression: "progressed" }), { status: 200 }),
    );
    await finalizeOrganizerMatch({
      organizationId: "org-1",
      contestId: "contest-1",
      winnerContestParticipantId: "participant-authoritative-1",
    });
    const request = vi.mocked(window.fetch).mock.calls[0]![1]!;
    expect(JSON.parse(String(request.body))).toEqual({
      organizationId: "org-1",
      contestId: "contest-1",
      winnerContestParticipantId: "participant-authoritative-1",
    });
  });
});
