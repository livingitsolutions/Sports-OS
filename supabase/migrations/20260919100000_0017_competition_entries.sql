/* Sprint 9: accepted structural participation in a Competition. */
CREATE TABLE public.competition_entries (
  id text PRIMARY KEY,
  competition_id text NOT NULL REFERENCES public.competitions(id),
  division_id text NULL,
  entrant_type text NOT NULL CHECK (entrant_type IN ('athlete','team')),
  athlete_profile_id text NULL REFERENCES public.athlete_profiles(id),
  team_id text NULL REFERENCES public.teams(id),
  status text NOT NULL CHECK (status IN ('active','withdrawn')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  CONSTRAINT competition_entries_division_competition_fk
    FOREIGN KEY (division_id, competition_id)
    REFERENCES public.competition_divisions(id, competition_id),
  CONSTRAINT competition_entries_entrant_identity_check CHECK (
    (entrant_type = 'athlete' AND athlete_profile_id IS NOT NULL AND team_id IS NULL)
    OR (entrant_type = 'team' AND team_id IS NOT NULL AND athlete_profile_id IS NULL)
  )
);
CREATE UNIQUE INDEX competition_entries_active_athlete_unique
  ON public.competition_entries(competition_id, athlete_profile_id)
  WHERE status = 'active' AND entrant_type = 'athlete';
CREATE UNIQUE INDEX competition_entries_active_team_unique
  ON public.competition_entries(competition_id, team_id)
  WHERE status = 'active' AND entrant_type = 'team';
CREATE INDEX competition_entries_competition_idx ON public.competition_entries(competition_id);
ALTER TABLE public.competition_entries ENABLE ROW LEVEL SECURITY;
