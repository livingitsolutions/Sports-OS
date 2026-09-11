/* global process, console, URL */

const value = process.env.TEST_DATABASE_URL ?? "";

if (value.trim().length === 0) {
  console.error("TEST_DATABASE_URL is required for PostgreSQL integration tests.");
  process.exit(1);
}

let url;
try {
  url = new URL(value);
} catch {
  console.error("TEST_DATABASE_URL must be a valid PostgreSQL connection URL.");
  process.exit(1);
}

if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
  console.error("TEST_DATABASE_URL must use the postgres:// or postgresql:// scheme.");
  process.exit(1);
}
