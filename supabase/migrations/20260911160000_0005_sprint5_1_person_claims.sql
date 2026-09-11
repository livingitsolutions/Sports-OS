/* Sprint 5.1: one-time authorization claims for linking an existing Person. */
CREATE TABLE IF NOT EXISTS person_claims (
  id text PRIMARY KEY,
  person_id text NOT NULL REFERENCES persons(id),
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT person_claims_status_valid CHECK (status IN ('pending','consumed','expired','revoked')),
  CONSTRAINT person_claims_version_positive CHECK (version >= 1),
  CONSTRAINT person_claims_consumption_consistent CHECK ((status = 'consumed' AND consumed_at IS NOT NULL) OR (status <> 'consumed' AND consumed_at IS NULL)),
  CONSTRAINT person_claims_expiration_after_creation CHECK (expires_at > created_at)
);
CREATE UNIQUE INDEX uq_person_claims_pending_person ON person_claims(person_id) WHERE status='pending';
CREATE INDEX idx_person_claims_pending_expiry ON person_claims(expires_at) WHERE status='pending';
ALTER TABLE person_claims ENABLE ROW LEVEL SECURITY;
