CREATE TABLE public.team_roster_memberships (
  id text PRIMARY KEY,
  team_id text NOT NULL REFERENCES public.teams(id),
  athlete_profile_id text NOT NULL REFERENCES public.athlete_profiles(id),
  status text NOT NULL CHECK (status IN ('active','inactive')),
  joined_at timestamptz NOT NULL,
  left_at timestamptz NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  CONSTRAINT team_roster_memberships_lifecycle CHECK ((status = 'active' AND left_at IS NULL) OR (status = 'inactive' AND left_at IS NOT NULL)),
  CONSTRAINT team_roster_memberships_time_order CHECK (left_at IS NULL OR left_at >= joined_at)
);
CREATE UNIQUE INDEX uq_active_team_athlete_roster ON public.team_roster_memberships(team_id, athlete_profile_id) WHERE status = 'active';
CREATE INDEX idx_team_roster_memberships_team ON public.team_roster_memberships(team_id);
CREATE INDEX idx_team_roster_memberships_athlete ON public.team_roster_memberships(athlete_profile_id);
CREATE INDEX idx_team_roster_memberships_team_status ON public.team_roster_memberships(team_id,status);
ALTER TABLE public.team_roster_memberships ENABLE ROW LEVEL SECURITY;
