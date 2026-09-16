/* Sprint 10.1.7: immutable, format-scoped competition outcome history.
   FK preflight: competition_formats.id text; competition_entries.id text;
   contest_results.id uuid. */
CREATE TABLE public.competition_outcomes (
  id uuid PRIMARY KEY,
  competition_format_id text NOT NULL REFERENCES public.competition_formats(id),
  status text NOT NULL CHECK (status = 'finalized'),
  finalized_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  UNIQUE (competition_format_id)
);
CREATE TABLE public.competition_placements (
  id uuid PRIMARY KEY,
  competition_outcome_id uuid NOT NULL REFERENCES public.competition_outcomes(id),
  competition_entry_id text NOT NULL REFERENCES public.competition_entries(id),
  position integer NOT NULL CHECK (position > 0),
  source_contest_result_id uuid NOT NULL REFERENCES public.contest_results(id),
  created_at timestamptz NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  UNIQUE (competition_outcome_id, position),
  UNIQUE (competition_outcome_id, competition_entry_id)
);
ALTER TABLE public.competition_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_placements ENABLE ROW LEVEL SECURITY;
