/**
 * Machine-enforced architecture boundaries for SportsOS (ADR-018).
 *
 * Run with `npm run architecture:check`. Violations of `error` severity fail
 * the check (non-zero exit). Aliases (@domain, @app, ...) are resolved from
 * tsconfig.app.json. `tsPreCompilationDeps` lets rules distinguish `import type`
 * (type-only, erased at build) from runtime imports.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      comment: "No dependency cycles anywhere in the source graph.",
      severity: "error",
      from: {},
      to: { circular: true },
    },

    // ---- Domain isolation -------------------------------------------------
    {
      name: "domain-no-app",
      comment: "Domain must not depend on the application layer.",
      severity: "error",
      from: { path: "^src/domain" },
      to: { path: "^src/app" },
    },
    {
      name: "domain-no-adapters",
      comment: "Domain must not depend on adapters/infrastructure.",
      severity: "error",
      from: { path: "^src/domain" },
      to: { path: "^src/adapters" },
    },
    {
      name: "domain-no-composition",
      comment: "Domain must not depend on composition wiring.",
      severity: "error",
      from: { path: "^src/domain" },
      to: { path: "^src/composition" },
    },
    {
      name: "domain-no-presentation",
      comment: "Domain must not depend on presentation (React shell).",
      severity: "error",
      from: { path: "^src/domain" },
      to: { path: "^src/(App|main)\\.tsx$" },
    },
    {
      name: "domain-no-external-sdk",
      comment:
        "Domain must be pure TypeScript: no React, browser, native, database, or payment packages.",
      severity: "error",
      from: { path: "^src/domain" },
      to: { dependencyTypes: ["npm", "npm-dev", "npm-optional", "npm-peer", "npm-bundled"] },
    },
    {
      name: "no-cross-context",
      comment:
        "A bounded context must not import another context's internal source files at all — including type-only imports (R26, ADR-018). Genuinely shared concepts must live in the shared kernel (e.g. @shared/measurement) or an explicitly published contract, never be reached into across contexts.",
      severity: "error",
      from: { path: "^src/domain/([^/]+)/" },
      to: {
        path: "^src/domain/([^/]+)/",
        pathNot: ["^src/domain/$1/"],
      },
    },

    // ---- Application isolation -------------------------------------------
    {
      name: "app-no-adapters",
      comment: "Application must not depend on concrete adapters.",
      severity: "error",
      from: { path: "^src/app" },
      to: { path: "^src/adapters" },
    },
    {
      name: "app-no-composition",
      comment: "Application must not depend on composition wiring.",
      severity: "error",
      from: { path: "^src/app" },
      to: { path: "^src/composition" },
    },
    {
      name: "app-no-presentation",
      comment: "Application must not depend on presentation components.",
      severity: "error",
      from: { path: "^src/app" },
      to: { path: "^src/(App|main)\\.tsx$" },
    },
    {
      name: "app-no-external-sdk",
      comment:
        "Application must be pure TypeScript: no React, browser, native, database, or payment packages (R21).",
      severity: "error",
      from: { path: "^src/app" },
      to: { dependencyTypes: ["npm", "npm-dev", "npm-optional", "npm-peer", "npm-bundled"] },
    },

    // ---- Presentation isolation ------------------------------------------
    {
      name: "presentation-no-adapters",
      comment:
        "Presentation must reach infrastructure through the composition root, not by importing adapters directly.",
      severity: "error",
      from: { path: "^src/(App|main)\\.tsx$" },
      to: { path: "^src/adapters" },
    },

    // ---- Adapter isolation -----------------------------------------------
    {
      name: "adapters-no-presentation-or-composition",
      comment: "Adapters must not depend on presentation or composition wiring.",
      severity: "error",
      from: { path: "^src/adapters" },
      to: { path: "^src/(App|main)\\.tsx$|^src/composition" },
    },
  ],

  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.app.json" },
    enhancedResolveOptions: {
      conditionNames: ["import", "require", "types"],
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    },
  },
};
