/* global Request, Response */
import type { ManageOrganizerContestLifecycle, OrganizerContestLifecycleInput } from "@app/use-cases/manage-organizer-contest-lifecycle";

const BEARER = /^Bearer [^\s]{1,4096}$/;
type Runtime = { readonly contestLifecycle: ManageOrganizerContestLifecycle; close(): Promise<void> };

export function createOrganizerContestLifecycleHandler(createRuntime: (authorization: string) => Runtime) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return json(405, { message: "Only POST is allowed." }, { Allow: "POST" });
    const authorization = request.headers.get("authorization");
    if (!authorization || !BEARER.test(authorization)) return json(401, { message: "Authentication is required." });
    let body: unknown;
    try { body = await request.json(); } catch { return json(400, { message: "Invalid lifecycle request." }); }
    if (!isInput(body)) return json(400, { message: "Invalid lifecycle request." });
    let runtime: Runtime | undefined;
    try {
      runtime = createRuntime(authorization);
      const result = await runtime.contestLifecycle.execute(body);
      if (result.ok) return json(200, result.value);
      const kind = result.error.kind;
      const status = kind === "unauthenticated" ? 401 : kind === "forbidden" ? 403 : kind === "not_found" ? 404 : kind === "concurrency_conflict" ? 409 : kind === "persistence_unavailable" || kind === "identity_provider_unavailable" ? 503 : 422;
      return json(status, { message: status === 401 ? "Authentication is required." : status === 403 ? "Lifecycle operation is not permitted." : status === 404 ? "Contest was not found." : status === 409 ? "The contest changed before this operation completed. Refresh and try again." : status === 503 ? "Lifecycle operation is temporarily unavailable." : "The contest cannot make that lifecycle transition." });
    } catch { return json(503, { message: "Lifecycle operation is temporarily unavailable." }); }
    finally { if (runtime) try { await runtime.close(); } catch { /* secret-free response */ } }
  };
}

function isInput(x: unknown): x is OrganizerContestLifecycleInput {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const r = x as Record<string, unknown>, keys = Object.keys(r);
  if (typeof r.organizationId !== "string" || !r.organizationId.trim() || typeof r.contestId !== "string" || !r.contestId.trim()) return false;
  if (r.operation === "schedule") return keys.length === 4 && keys.every(k => ["organizationId", "contestId", "operation", "scheduledAt"].includes(k)) && typeof r.scheduledAt === "string" && !!r.scheduledAt.trim();
  return (r.operation === "start" || r.operation === "complete") && keys.length === 3 && keys.every(k => ["organizationId", "contestId", "operation"].includes(k));
}
function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", ...extra } });
}
