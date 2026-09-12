/* Sprint 10.1.1: atomic CompetitionFormat plan materialization. */
ALTER TABLE public.competition_stages ADD COLUMN competition_format_id text NULL REFERENCES public.competition_formats(id);
CREATE UNIQUE INDEX competition_stages_format_sequence_unique ON public.competition_stages(competition_format_id,sequence) WHERE competition_format_id IS NOT NULL;
CREATE TABLE public.competition_format_materializations(competition_format_id text PRIMARY KEY REFERENCES public.competition_formats(id),created_at timestamptz NOT NULL);
ALTER TABLE public.competition_format_materializations ENABLE ROW LEVEL SECURITY;
