/* Sprint 6.2: organization-scoped roles, permissions, and assignments. */
ALTER TABLE organization_memberships ADD CONSTRAINT organization_memberships_id_organization_unique UNIQUE (id, organization_id);
CREATE TABLE organization_roles (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  key text NOT NULL CHECK (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(key) <= 64),
  permissions text[] NOT NULL CHECK (cardinality(permissions) > 0),
  status text NOT NULL CHECK (status IN ('active','inactive')),
  version integer NOT NULL CHECK (version > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT organization_roles_organization_key_unique UNIQUE (organization_id, key),
  CONSTRAINT organization_roles_id_organization_unique UNIQUE (id, organization_id)
);
CREATE TABLE organization_role_assignments (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id),
  membership_id text NOT NULL,
  role_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('active','inactive')),
  version integer NOT NULL CHECK (version > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT organization_role_assignments_membership_role_unique UNIQUE (membership_id, role_id),
  CONSTRAINT organization_role_assignments_membership_organization_fk FOREIGN KEY (membership_id, organization_id) REFERENCES organization_memberships(id, organization_id),
  CONSTRAINT organization_role_assignments_role_organization_fk FOREIGN KEY (role_id, organization_id) REFERENCES organization_roles(id, organization_id)
);
CREATE INDEX organization_role_assignments_active_membership_idx ON organization_role_assignments (membership_id) WHERE status = 'active';
ALTER TABLE organization_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_role_assignments ENABLE ROW LEVEL SECURITY;
