/**
 * Neutral measurement vocabulary shared across bounded contexts.
 *
 * `CompetitionMeasure` describes HOW a result is measured. Both the Sports
 * Catalog context (a Discipline's default measure) and the Competition context
 * (a Competition's measure) legitimately need this vocabulary. It carries no
 * behaviour and no context-specific meaning, so it lives in the shared kernel
 * as an explicitly published neutral contract rather than being owned by one
 * context and reached into by another (ADR-018, R26).
 */
export type CompetitionMeasure =
  | "timed"
  | "measured_distance"
  | "measured_score"
  | "judged"
  | "head_to_head"
  | "placement";
