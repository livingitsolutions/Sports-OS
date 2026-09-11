import type { Id, ISODateString } from "@shared/kernel";
import type { SportsId } from "@domain/identity/identity.types";

/**
 * Issues a Sports ID value object in the "active" state.
 *
 * The domain does NOT invent the identifier value — a Sports ID is generated
 * outside the domain (by an application-owned generator) and passed in as a
 * value, together with the issuance timestamp. This keeps the domain pure and
 * lets the application enforce global uniqueness before issuance.
 *
 * A Sports ID is permanent once issued: there is deliberately no operation to
 * change its value. Revocation (a separate future concern) would change only
 * `status`, never the value, and never re-use a value on another Person.
 */
export function issueSportsId(
  value: Id<"SportsId">,
  issuedAt: ISODateString,
): SportsId {
  return { value, issuedAt, status: "active" };
}

export function isActive(sportsId: SportsId): boolean {
  return sportsId.status === "active";
}
