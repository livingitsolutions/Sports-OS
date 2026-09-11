import type { AppResult } from "@app/contracts/result";

/**
 * Generic application use-case contract. A use-case takes a typed input and
 * returns a typed result that may fail in expected ways. Concrete use-cases
 * live per bounded context under `src/app/use-cases/` (added with vertical
 * slices, not preemptively).
 */
export interface UseCase<Input, Output> {
  execute(input: Input): Promise<AppResult<Output>>;
}
