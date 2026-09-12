/* Sprint 6.1: durable Person-to-Organization membership lifecycle. */
CREATE TABLE organization_memberships (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id),
  person_id text NOT NULL REFERENCES persons(id),
  status text NOT NULL,
  version integer NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT organization_memberships_pair_unique UNIQUE (organization_id, person_id),
  CONSTRAINT organization_memberships_status_valid CHECK (status IN ('active','inactive')),
  CONSTRAINT organization_memberships_version_positive CHECK (version >= 1)
);
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
