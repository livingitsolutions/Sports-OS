/* Sprint 6.5: explicit, scoped, direct Organization trust. */
DO $$
DECLARE malformed_count bigint;
BEGIN
  SELECT count(*) INTO malformed_count FROM organization_roles
  WHERE role_kind='system' AND key='organization-admin'
    AND NOT (cardinality(permissions)=6
      AND permissions @> ARRAY['organization.read','organization.update','organization.members.read','organization.members.manage','organization.roles.read','organization.roles.manage']::text[]
      AND permissions <@ ARRAY['organization.read','organization.update','organization.members.read','organization.members.manage','organization.roles.read','organization.roles.manage']::text[]);
  IF malformed_count > 0 THEN RAISE EXCEPTION 'malformed organization-admin system role permission set'; END IF;
  UPDATE organization_roles SET permissions=ARRAY['organization.members.manage','organization.members.read','organization.read','organization.roles.manage','organization.roles.read','organization.trust.manage','organization.trust.read','organization.update']::text[],version=version+1,updated_at=clock_timestamp()
  WHERE role_kind='system' AND key='organization-admin';
END $$;

CREATE TABLE organization_trusts (
  id text PRIMARY KEY,
  issuer_organization_id text NOT NULL REFERENCES organizations(id),
  subject_organization_id text NOT NULL REFERENCES organizations(id),
  scope text NOT NULL CHECK (scope IN ('organizer.verified','competition.sanctioning','governing.authority')),
  status text NOT NULL CHECK (status IN ('active','revoked')),
  issued_at timestamptz NOT NULL,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  CHECK (issuer_organization_id <> subject_organization_id),
  CHECK ((status='active' AND revoked_at IS NULL) OR (status='revoked' AND revoked_at IS NOT NULL)),
  CHECK (expires_at IS NULL OR expires_at > issued_at),
  CHECK (created_at=issued_at),
  CHECK (updated_at>=created_at),
  CHECK (revoked_at IS NULL OR revoked_at>=issued_at)
);
CREATE INDEX organization_trusts_issuer_scope_idx ON organization_trusts(issuer_organization_id,scope);
CREATE INDEX organization_trusts_subject_scope_idx ON organization_trusts(subject_organization_id,scope);
CREATE INDEX organization_trusts_direct_idx ON organization_trusts(issuer_organization_id,subject_organization_id,scope);
ALTER TABLE organization_trusts ENABLE ROW LEVEL SECURITY;
