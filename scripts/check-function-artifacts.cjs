const { execFileSync } = require("node:child_process");
const { readdirSync } = require("node:fs");
const path = require("node:path");
const { stdout } = require("node:process");

const artifactsDirectory = path.resolve(".netlify/functions");
const expectedFunctions = [
  "account-link-person",
  "organizer-context",
  "tournament-operations",
  "finalize-organizer-match",
  "retry-organizer-progression",
  "finalize-organizer-outcome",
];
const applicationAlias = /@(adapters|app|domain|composition|shared)\//g;

const zipNames = readdirSync(artifactsDirectory)
  .filter((name) => name.endsWith(".zip"))
  .sort();
const missingFunctions = expectedFunctions.filter(
  (name) => !zipNames.includes(`${name}.zip`),
);

if (missingFunctions.length > 0) {
  throw new Error(
    `Missing Netlify Function artifacts: ${missingFunctions.join(", ")}`,
  );
}

const unresolved = [];
for (const zipName of zipNames) {
  const zipPath = path.join(artifactsDirectory, zipName);
  const entries = execFileSync("unzip", ["-Z1", zipPath], {
    encoding: "utf8",
  })
    .split("\n")
    .filter((name) => /\.(?:js|mjs)$/.test(name));

  for (const entry of entries) {
    const source = execFileSync("unzip", ["-p", zipPath, entry], {
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    });
    const matches = source.match(applicationAlias) ?? [];
    if (matches.length > 0) {
      unresolved.push({ zipName, entry, count: matches.length });
    }
  }
}

if (unresolved.length > 0) {
  const details = unresolved
    .map(({ zipName, entry, count }) => `${zipName}:${entry} (${count})`)
    .join("\n");
  throw new Error(`Unresolved SportsOS aliases found:\n${details}`);
}

stdout.write(
  `Checked ${zipNames.length} Netlify Function ZIP artifacts; unresolved SportsOS aliases: 0.\n`,
);
