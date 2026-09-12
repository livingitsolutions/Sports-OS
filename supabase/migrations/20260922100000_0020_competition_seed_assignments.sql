/* Sprint 10.1.2: frozen materialization entrant count and seed assignments. */
ALTER TABLE public.competition_format_materializations
  ADD COLUMN entrant_count integer NOT NULL CHECK (entrant_count > 0);

CREATE TABLE public.competition_seed_assignments (
  id uuid PRIMARY KEY,
  competition_format_id text NOT NULL REFERENCES public.competition_formats(id),
  competition_entry_id text NOT NULL REFERENCES public.competition_entries(id),
  seed_number integer NOT NULL CHECK (seed_number > 0),
  version integer NOT NULL CHECK (version >= 1),
  created_at timestamptz NOT NULL,
  CONSTRAINT competition_seed_assignments_format_seed_unique UNIQUE (competition_format_id, seed_number),
  CONSTRAINT competition_seed_assignments_format_entry_unique UNIQUE (competition_format_id, competition_entry_id)
);
ALTER TABLE public.competition_seed_assignments ENABLE ROW LEVEL SECURITY;
