/* Sprint 10: sport-neutral competition format selection and durable history. */
CREATE TABLE public.competition_formats(
 id text PRIMARY KEY,
 competition_id text NOT NULL REFERENCES public.competitions(id),
 division_id text NULL,
 kind text NOT NULL CHECK(kind IN('single_elimination','double_elimination','round_robin','groups_knockout','swiss','league','ladder')),
 status text NOT NULL CHECK(status IN('active','retired')),
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL,
 version integer NOT NULL CHECK(version>0),
 CONSTRAINT competition_formats_division_competition_fk FOREIGN KEY(division_id,competition_id) REFERENCES public.competition_divisions(id,competition_id)
);
CREATE UNIQUE INDEX competition_formats_competition_active_unique ON public.competition_formats(competition_id) WHERE division_id IS NULL AND status='active';
CREATE UNIQUE INDEX competition_formats_division_active_unique ON public.competition_formats(competition_id,division_id) WHERE division_id IS NOT NULL AND status='active';
CREATE INDEX competition_formats_competition_idx ON public.competition_formats(competition_id);
ALTER TABLE public.competition_formats ENABLE ROW LEVEL SECURITY;
