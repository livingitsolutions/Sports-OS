/* Sprint 10.1.5: authoritative, sport-neutral Contest results. */
CREATE TABLE public.contest_results (
  id uuid PRIMARY KEY,
  contest_id text NOT NULL REFERENCES public.contests(id),
  status text NOT NULL CHECK (status IN ('draft','finalized')),
  created_at timestamptz NOT NULL,
  finalized_at timestamptz NULL,
  version integer NOT NULL CHECK (version >= 1),
  UNIQUE (contest_id),
  CONSTRAINT contest_results_finalized_at_check CHECK ((status = 'finalized' AND finalized_at IS NOT NULL) OR (status = 'draft' AND finalized_at IS NULL))
);
CREATE TABLE public.contest_result_outcomes (
  id uuid PRIMARY KEY,
  contest_result_id uuid NOT NULL REFERENCES public.contest_results(id),
  contest_participant_id uuid NOT NULL REFERENCES public.contest_participants(id),
  outcome text NOT NULL CHECK (outcome IN ('winner','loser')),
  position integer NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (contest_result_id,contest_participant_id),
  UNIQUE (contest_result_id,outcome)
);
ALTER TABLE public.contest_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_result_outcomes ENABLE ROW LEVEL SECURITY;
