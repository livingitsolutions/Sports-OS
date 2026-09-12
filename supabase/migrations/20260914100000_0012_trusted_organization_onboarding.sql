/* Sprint 6.4: stable replay identity for trusted, atomic Organization onboarding. */
CREATE TABLE organization_onboardings (
  request_key text PRIMARY KEY CHECK (char_length(btrim(request_key)) BETWEEN 1 AND 200),
  organization_id text NOT NULL UNIQUE REFERENCES organizations(id),
  initial_administrator_person_id text NOT NULL REFERENCES persons(id),
  created_at timestamptz NOT NULL
);
ALTER TABLE organization_onboardings ENABLE ROW LEVEL SECURITY;
