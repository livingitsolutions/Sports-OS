/* Sprint 5: Account bridges an external Supabase auth subject to one existing Person. */
CREATE TABLE IF NOT EXISTS accounts (
  id text PRIMARY KEY,
  auth_subject text NOT NULL UNIQUE,
  person_id text NOT NULL UNIQUE REFERENCES persons(id),
  status text NOT NULL DEFAULT 'active',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT accounts_status_valid CHECK (status IN ('active','disabled')),
  CONSTRAINT accounts_version_positive CHECK (version >= 1)
);

-- Deny Data API access by default. Trusted server-side PostgreSQL persistence remains authoritative.
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
