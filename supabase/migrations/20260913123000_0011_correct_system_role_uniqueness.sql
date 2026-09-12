/* Sprint 6.3.1: system roles are unique by Organization-local key, not by kind. */
DROP INDEX organization_roles_one_system_role_per_organization;
