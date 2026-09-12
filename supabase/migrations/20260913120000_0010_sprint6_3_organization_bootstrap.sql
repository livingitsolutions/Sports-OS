/* Sprint 6.3: distinguish trusted system roles from ordinary custom roles. */
ALTER TABLE organization_roles ADD COLUMN role_kind text NOT NULL DEFAULT 'custom' CONSTRAINT organization_roles_role_kind_check CHECK (role_kind IN ('system','custom'));
CREATE UNIQUE INDEX organization_roles_one_system_role_per_organization ON organization_roles (organization_id) WHERE role_kind = 'system';
