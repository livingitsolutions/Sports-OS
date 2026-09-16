/* global Request, Response */
import type { FinalizeOrganizerMatchResult } from "@app/use-cases/finalize-organizer-match-result";
const BEARER = /^Bearer [^\s]{1,4096}$/;
export interface FinalizeMatchRuntime {
  readonly finalizeMatch: FinalizeOrganizerMatchResult;
  close(): Promise<void>;
}
export function createFinalizeOrganizerMatchHandler(
  createRuntime: (authorization: string) => FinalizeMatchRuntime,
) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST")
      return json(405, { message: "Only POST is allowed." }, { Allow: "POST" });
    const authorization = request.headers.get("authorization");
    if (!authorization || !BEARER.test(authorization))
      return json(401, { message: "Authentication is required." });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json(400, { message: "Invalid result request." });
    }
    if (!isInput(body))
      return json(400, { message: "Invalid result request." });
    let runtime: FinalizeMatchRuntime | undefined;
    try {
      runtime = createRuntime(authorization);
      const result = await runtime.finalizeMatch.execute(body);
      if (result.ok)
        return json(
          result.value.progression === "progressed" ? 200 : 202,
          result.value,
        );
      const kind = result.error.kind,
        status =
          kind === "unauthenticated"
            ? 401
            : kind === "forbidden"
              ? 403
              : kind === "result_already_finalized"
                ? 409
                : kind === "persistence_unavailable" ||
                    kind === "identity_provider_unavailable"
                  ? 503
                  : 422;
      return json(status, {
        message:
          status === 401
            ? "Authentication is required."
            : status === 403
              ? "Result operation is not permitted."
              : status === 409
                ? "This match already has an authoritative result."
                : status === 503
                  ? "Result operation is temporarily unavailable."
                  : "This match result cannot be finalized.",
      });
    } catch {
      return json(503, {
        message: "Result operation is temporarily unavailable.",
      });
    } finally {
      if (runtime)
        try {
          await runtime.close();
        } catch {
          /* secret-free response */
        }
    }
  };
}
function isInput(
  x: unknown,
): x is {
  organizationId: string;
  contestId: string;
  winnerContestParticipantId: string;
} {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const r = x as Record<string, unknown>,
    keys = Object.keys(r);
  return (
    keys.length === 3 &&
    keys.every((k) =>
      ["organizationId", "contestId", "winnerContestParticipantId"].includes(k),
    ) &&
    typeof r.organizationId === "string" &&
    !!r.organizationId.trim() &&
    typeof r.contestId === "string" &&
    !!r.contestId.trim() &&
    typeof r.winnerContestParticipantId === "string" &&
    !!r.winnerContestParticipantId.trim()
  );
}
function json(
  status: number,
  body: unknown,
  extra: Record<string, string> = {},
): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });
}
