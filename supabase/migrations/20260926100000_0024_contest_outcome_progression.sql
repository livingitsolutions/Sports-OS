/* Sprint 10.1.6: one-hop finalized ContestResult progression. */
ALTER TABLE public.contest_participants
  DROP CONSTRAINT contest_participants_source_type_check,
  DROP CONSTRAINT contest_participants_seed_source_check,
  ADD COLUMN source_contest_result_id uuid NULL REFERENCES public.contest_results(id),
  ADD COLUMN source_outcome text NULL CHECK (source_outcome IN ('winner','loser')),
  ADD CONSTRAINT contest_participants_provenance_check CHECK (
    (source_type = 'seed' AND source_seed_number IS NOT NULL AND source_contest_result_id IS NULL AND source_outcome IS NULL)
    OR
    (source_type = 'contest_outcome' AND source_seed_number IS NULL AND source_contest_result_id IS NOT NULL AND source_outcome IS NOT NULL)
  );
CREATE TABLE public.contest_result_progressions (
  contest_result_id uuid PRIMARY KEY REFERENCES public.contest_results(id),
  competition_format_id uuid NOT NULL REFERENCES public.competition_formats(id),
  progressed_at timestamptz NOT NULL,
  participant_count integer NOT NULL CHECK (participant_count >= 0)
);
ALTER TABLE public.contest_result_progressions ENABLE ROW LEVEL SECURITY;
