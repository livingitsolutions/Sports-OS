/*
# Sprint 4 — Core production persistence schema (SportsOS)

This migration introduces the first durable persistence for the already-proven
Sprint 2/3 foundation: Person + Sports ID, AthleteProfile, and multi-sport
AthleteSportParticipation history, plus the minimal Sport reference table the
athlete slice requires. It creates NO organization, tenant, event, registration,
payment, rewards, QR, or authorization tables — those are out of scope.

## 1. New tables

1. `persons` — platform-global natural/legal identity.
   - `id` (text, PK) — application-generated Person identifier.
   - `display_name` (text, not null) — mutable identity label (trimmed, <=200 chars).
   - `date_of_birth` (date, nullable) — PRIVATE identity data. Never exposed
     through public read models; not copied into athlete tables.
   - `lifecycle_status` (text, not null) — active | deactivated | archived | anonymized.
   - `version` (integer, not null, default 1) — optimistic-concurrency version.
   - `created_at` (timestamptz, not null, default now()) — audit timestamp.

2. `sports_ids` — the permanent, platform-issued Sports ID (one-to-one with a Person).
   - `value` (text, PK) — the public, globally-unique Sports ID (no personal data encoded).
   - `person_id` (text, not null, UNIQUE, FK -> persons.id) — the owning Person.
   - `issued_at` (timestamptz, not null) — issuance timestamp.
   - `status` (text, not null) — active | revoked.

3. `sports` — platform-global reference data (NOT tenant-owned).
   - `id` (text, PK) — application/stable Sport identifier.
   - `code` (text, not null, UNIQUE) — short stable code.
   - `name` (text, not null) — display name.
   - `created_at` (timestamptz, not null, default now()).

4. `athlete_profiles` — optional, sport-independent, person-level sporting identity.
   - `id` (text, PK) — unique AthleteProfile identifier.
   - `person_id` (text, not null, UNIQUE, FK -> persons.id) — at most one profile per Person.
   - `status` (text, not null) — active | inactive.
   - `version` (integer, not null, default 1) — optimistic-concurrency version.
   - `created_at` (timestamptz, not null).
   - Holds NO Person identity data (no name, DOB, or Sports ID).

5. `athlete_sport_participations` — many-to-many participation history.
   - `id` (text, PK).
   - `athlete_profile_id` (text, not null, FK -> athlete_profiles.id).
   - `sport_id` (text, not null, FK -> sports.id).
   - `status` (text, not null) — active | ended.
   - `started_at` (timestamptz, not null).
   - `ended_at` (timestamptz, nullable) — set only when ended.

## 2. Constraints / indexes protecting domain invariants

- persons.display_name non-empty + length check.
- persons/athlete_profiles.version >= 1.
- sports_ids: PK on `value` (globally unique public ID); UNIQUE on `person_id`
  (at most one Sports ID per Person, and a Sports ID cannot belong to multiple
  people); FK to persons.
- athlete_profiles.person_id UNIQUE (at most one profile per Person).
- athlete_sport_participations lifecycle CHECK: active => ended_at IS NULL;
  ended => ended_at IS NOT NULL.
- Partial UNIQUE index `uq_active_participation_per_sport` on
  (athlete_profile_id, sport_id) WHERE status = 'active' — enforces AT MOST ONE
  ACTIVE participation per (profile, sport) while preserving unlimited ended
  historical periods and allowing re-entry.
- Supporting index on athlete_sport_participations(athlete_profile_id).

## 3. Security

- Row Level Security is ENABLED on all five tables. NO policies are created:
  the tables are therefore deny-all through the Supabase Data API (anon /
  authenticated roles). The application reaches this data ONLY through a trusted
  server-side direct Postgres connection (the owner/service role, which bypasses
  RLS). Tenant/auth-scoped RLS policies are intentionally deferred to the first
  organization/tenant-owned persistence slice (see ADR + persistence docs); this
  migration does not weaken that future requirement.

## 4. Important notes

1. No destructive operations. This is an additive, initial migration.
2. No transaction-control statements are used.
3. `version` columns establish the optimistic-concurrency foundation for the
   mutable aggregate roots (Person, AthleteProfile). No update use case exists
   yet; the columns + semantics are documented for future mutation slices.
*/

CREATE TABLE IF NOT EXISTS persons (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  date_of_birth date,
  lifecycle_status text NOT NULL DEFAULT 'active',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT persons_display_name_non_empty CHECK (length(btrim(display_name)) > 0),
  CONSTRAINT persons_display_name_max_len CHECK (length(display_name) <= 200),
  CONSTRAINT persons_lifecycle_status_valid CHECK (lifecycle_status IN ('active','deactivated','archived','anonymized')),
  CONSTRAINT persons_version_positive CHECK (version >= 1)
);

CREATE TABLE IF NOT EXISTS sports_ids (
  value text PRIMARY KEY,
  person_id text NOT NULL UNIQUE REFERENCES persons(id),
  issued_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active',
  CONSTRAINT sports_ids_status_valid CHECK (status IN ('active','revoked'))
);

CREATE TABLE IF NOT EXISTS sports (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS athlete_profiles (
  id text PRIMARY KEY,
  person_id text NOT NULL UNIQUE REFERENCES persons(id),
  status text NOT NULL DEFAULT 'active',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  CONSTRAINT athlete_profiles_status_valid CHECK (status IN ('active','inactive')),
  CONSTRAINT athlete_profiles_version_positive CHECK (version >= 1)
);

CREATE TABLE IF NOT EXISTS athlete_sport_participations (
  id text PRIMARY KEY,
  athlete_profile_id text NOT NULL REFERENCES athlete_profiles(id),
  sport_id text NOT NULL REFERENCES sports(id),
  status text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  CONSTRAINT participation_status_valid CHECK (status IN ('active','ended')),
  CONSTRAINT participation_lifecycle_consistent CHECK (
    (status = 'active' AND ended_at IS NULL)
    OR (status = 'ended' AND ended_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_participation_per_sport
  ON athlete_sport_participations (athlete_profile_id, sport_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_participation_profile
  ON athlete_sport_participations (athlete_profile_id);

ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE athlete_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE athlete_sport_participations ENABLE ROW LEVEL SECURITY;
