/**
 * Shared kernel primitives used across bounded contexts.
 *
 * This module is the ONLY module that every layer may depend on. It must
 * contain no domain semantics and no infrastructure concerns — only generic
 * value-object bases and type helpers.
 */

/**
 * Branded primitive. Used to distinguish identifiers that share a string
 * representation but belong to different aggregates (e.g. PersonId vs SportsId).
 */
export type Brand<T, B extends string> = T & { readonly __brand: B };

/** Strongly-typed identifier base. */
export type Id<B extends string> = Brand<string, B>;

/** ISO-8601 timestamp in UTC. */
export type ISODateString = Brand<string, "ISODate">;

/** Result wrapper for operations that can fail in expected ways. */
export type Result<T, E = DomainError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Base error shape carried by Result. */
export interface DomainError {
  readonly code: string;
  readonly message: string;
  readonly details?: ReadonlyArray<readonly [string, string]>;
}

export namespace Result {
  export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
  export const fail = <E extends DomainError>(error: E): Result<never, E> => ({
    ok: false,
    error,
  });
}
