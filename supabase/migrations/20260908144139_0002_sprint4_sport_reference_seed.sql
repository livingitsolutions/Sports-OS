/*
# Sprint 4 — Minimal Sport reference seed (SportsOS)

Seeds a small, deterministic set of platform-global Sport reference rows so the
athlete participation slice has real sports to reference in development and
schema validation.

## 1. Data seeded
Inserts a minimal set of well-known sports into `sports` (id, code, name).

## 2. Important notes
1. This set is NOT an exhaustive or authoritative production sports taxonomy.
   It is a development/validation convenience only.
2. No application business logic depends on this exact set.
3. Idempotent: uses ON CONFLICT DO NOTHING so re-running changes nothing and
   never overwrites edited rows.
4. No destructive operations; no transaction-control statements.
*/

INSERT INTO sports (id, code, name) VALUES
  ('sport-basketball', 'BKB', 'Basketball'),
  ('sport-volleyball', 'VLB', 'Volleyball'),
  ('sport-swimming',   'SWM', 'Swimming'),
  ('sport-athletics',  'ATH', 'Athletics'),
  ('sport-boxing',     'BOX', 'Boxing'),
  ('sport-football',   'FBL', 'Football'),
  ('sport-badminton',  'BDM', 'Badminton'),
  ('sport-chess',      'CHS', 'Chess')
ON CONFLICT (id) DO NOTHING;
