/* Sprint 7: Organization-owned, sport-aware Team identity and lifecycle. */
DO $$
DECLARE malformed_count bigint;
BEGIN
  SELECT count(*) INTO malformed_count FROM organization_roles
  WHERE role_kind='system' AND key='organization-admin'
    AND NOT (cardinality(permissions)=8
      AND permissions @> ARRAY['organization.read','organization.update','organization.members.read','organization.members.manage','organization.roles.read','organization.roles.manage','organization.trust.read','organization.trust.manage']::text[]
      AND permissions <@ ARRAY['organization.read','organization.update','organization.members.read','organization.members.manage','organization.roles.read','organization.roles.manage','organization.trust.read','organization.trust.manage']::text[]);
  IF malformed_count > 0 THEN RAISE EXCEPTION 'malformed organization-admin system role permission set'; END IF;
  UPDATE organization_roles SET permissions=ARRAY['organization.members.manage','organization.members.read','organization.read','organization.roles.manage','organization.roles.read','organization.teams.manage','organization.teams.read','organization.trust.manage','organization.trust.read','organization.update']::text[],version=version+1,updated_at=clock_timestamp()
  WHERE role_kind='system' AND key='organization-admin';
END $$;
CREATE TABLE teams (
  id text PRIMARY KEY, organization_id text NOT NULL REFERENCES organizations(id), sport_id text NOT NULL REFERENCES sports(id),
  name text NOT NULL CHECK (name=btrim(name) AND char_length(name) BETWEEN 1 AND 120),
  key text NOT NULL CHECK (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(key) <= 64),
  status text NOT NULL CHECK (status IN ('active','inactive')), created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL CHECK (updated_at>=created_at), version integer NOT NULL CHECK (version > 0),
  CONSTRAINT teams_organization_key_unique UNIQUE (organization_id,key)
);
CREATE INDEX teams_organization_id_idx ON teams(organization_id);
CREATE INDEX teams_sport_id_idx ON teams(sport_id);
CREATE INDEX teams_organization_status_idx ON teams(organization_id,status);
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
