// Architecture fixture. Simulates a module that reaches straight into the
// adapters layer at runtime — the kind of import the boundary rules must catch.
// It is NOT under src/, so `npm run architecture:check` (which scans src only)
// never sees it; only the architecture test cruises this directory on purpose.
import { SystemClock } from "../../../src/adapters/clock/system-clock";

export const leakedAdapter = SystemClock;
