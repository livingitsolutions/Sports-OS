/* Sprint 10.1.4: finalized seeds enter durable Contest positions. */
ALTER TABLE public.contests ADD COLUMN plan_ref text NULL;
CREATE UNIQUE INDEX contests_stage_plan_ref_unique ON public.contests(stage_id,plan_ref) WHERE plan_ref IS NOT NULL;
ALTER TABLE public.competition_format_materializations ADD COLUMN participants_materialized_at timestamptz NULL;

CREATE TABLE public.contest_participants (
  id uuid PRIMARY KEY,
  contest_id text NOT NULL REFERENCES public.contests(id),
  position integer NOT NULL CHECK (position > 0),
  competition_entry_id text NOT NULL REFERENCES public.competition_entries(id),
  source_type text NOT NULL CHECK (source_type IN ('seed')),
  source_seed_number integer NULL,
  version integer NOT NULL CHECK (version >= 1),
  created_at timestamptz NOT NULL,
  CONSTRAINT contest_participants_seed_source_check CHECK (source_type <> 'seed' OR source_seed_number > 0),
  CONSTRAINT contest_participants_contest_position_unique UNIQUE (contest_id,position),
  CONSTRAINT contest_participants_contest_entry_unique UNIQUE (contest_id,competition_entry_id)
);
ALTER TABLE public.contest_participants ENABLE ROW LEVEL SECURITY;
