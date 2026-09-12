/* Sprint 10.1.3: explicit immutable seed-map boundary. */
ALTER TABLE public.competition_format_materializations
  ADD COLUMN seed_finalized_at timestamptz NULL;
