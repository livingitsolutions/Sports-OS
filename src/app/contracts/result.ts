import type { DomainError, Result } from "@shared/kernel";

/**
 * Application-layer error contract. Reuses the shared error shape and adds an
 * optional non-serialized cause for logging. Use-cases return
 * `Result<Output, AppError>`; the shared kernel `Result` is the carrier.
 */
export interface AppError extends DomainError {
  readonly cause?: unknown;
}

/** Convenience alias for a use-case result. */
export type AppResult<T> = Result<T, AppError>;
