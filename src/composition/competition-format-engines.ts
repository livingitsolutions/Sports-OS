import { CompetitionFormatEngineRegistry } from "@domain/competition/competition-format-engine";
import { SingleEliminationEngine } from "@domain/competition/single-elimination-engine";

export function createCompetitionFormatEngineRegistry(): CompetitionFormatEngineRegistry {
  const registry = new CompetitionFormatEngineRegistry();
  const registered = registry.register(new SingleEliminationEngine());
  if (!registered.ok) throw new Error(registered.error.message);
  return registry;
}
