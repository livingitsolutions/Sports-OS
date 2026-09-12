/* Sprint 6: platform-wide organizational identities. */
CREATE TABLE IF NOT EXISTS organizations (
  id text PRIMARY KEY,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 100),
  type text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT organizations_type_valid CHECK (type IN ('club','league','association','federation','school','government_body','company','event_organizer','venue_operator','other')),
  CONSTRAINT organizations_status_valid CHECK (status IN ('active','inactive')),
  CONSTRAINT organizations_version_positive CHECK (version >= 1)
);
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
