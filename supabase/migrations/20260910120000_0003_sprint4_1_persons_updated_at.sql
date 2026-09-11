/* Sprint 4.1: explicit Person update timestamp used by aggregate mutations. */
ALTER TABLE persons ADD COLUMN updated_at timestamptz;
UPDATE persons SET updated_at = created_at;
ALTER TABLE persons ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE persons ALTER COLUMN updated_at SET NOT NULL;
