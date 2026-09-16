/* global Request */
import { describe, expect, it, vi } from "vitest";
import { createFinalizeOrganizerMatchHandler } from "@adapters/http/finalize-organizer-match-handler";

const valid = {
  organizationId: "org",
  contestId: "contest",
  winnerContestParticipantId: "participant",
};
const request = (body: unknown, authorization = "Bearer verified-token") =>
  new Request("https://sports.test/result", {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("finalize organizer match HTTP boundary", () => {
  it("rejects unauthenticated commands before composition", async () => {
    const create = vi.fn();
    const response = await createFinalizeOrganizerMatchHandler(create)(
      request(valid, ""),
    );
    expect(response.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });
  it.each([
    "actingMembershipId",
    "personId",
    "accountId",
    "providerUserId",
    "loserContestParticipantId",
    "progressionTarget",
    "downstreamParticipant",
    "champion",
  ])("rejects browser asserted %s", async (field) => {
    const create = vi.fn();
    const response = await createFinalizeOrganizerMatchHandler(create)(
      request({ ...valid, [field]: "tampered" }),
    );
    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
  it("passes only resource and winner selection to the authenticated facade", async () => {
    const execute = vi
        .fn()
        .mockResolvedValue({
          ok: true,
          value: { contestResultId: "result", progression: "progressed" },
        }),
      close = vi.fn().mockResolvedValue(undefined);
    const response = await createFinalizeOrganizerMatchHandler(() => ({
      finalizeMatch: { execute } as never,
      close,
    }))(request(valid));
    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledWith(valid);
    expect(close).toHaveBeenCalled();
  });
  it("reports a persisted result with pending progression honestly", async () => {
    const execute = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        value: { contestResultId: "result", progression: "pending" },
      });
    const response = await createFinalizeOrganizerMatchHandler(() => ({
      finalizeMatch: { execute } as never,
      close: async () => undefined,
    }))(request(valid));
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      contestResultId: "result",
      progression: "pending",
    });
  });
  it("maps duplicate finalization to a safe conflict", async () => {
    const execute = vi
      .fn()
      .mockResolvedValue({
        ok: false,
        error: { kind: "result_already_finalized" },
      });
    const response = await createFinalizeOrganizerMatchHandler(() => ({
      finalizeMatch: { execute } as never,
      close: async () => undefined,
    }))(request(valid));
    expect(response.status).toBe(409);
    expect(JSON.stringify(await response.json())).not.toMatch(
      /database|postgres|constraint/i,
    );
  });
});
