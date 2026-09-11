/* Sprint 5.2: bounded lookup, explicit HMAC key version, and issuance provenance. */
ALTER TABLE person_claims
  ADD COLUMN lookup_id text,
  ADD COLUMN hash_key_version text,
  ADD COLUMN issued_by_type text,
  ADD COLUMN issued_by_subject text;

/* Existing rows are disposable/internal only. Preserve hashes but mark them as non-verifiable legacy data. */
UPDATE person_claims SET
  lookup_id = 'legacy_' || md5(id),
  hash_key_version = 'legacy_v1',
  issued_by_type = 'system',
  issued_by_subject = 'migration-0006'
WHERE lookup_id IS NULL;

ALTER TABLE person_claims
  ALTER COLUMN lookup_id SET NOT NULL,
  ALTER COLUMN hash_key_version SET NOT NULL,
  ALTER COLUMN issued_by_type SET NOT NULL,
  ALTER COLUMN issued_by_subject SET NOT NULL,
  ADD CONSTRAINT person_claims_lookup_id_safe CHECK (lookup_id ~ '^[A-Za-z0-9_-]{16,128}$'),
  ADD CONSTRAINT person_claims_hash_key_version_safe CHECK (hash_key_version ~ '^[a-z][a-z0-9_-]{0,31}$'),
  ADD CONSTRAINT person_claims_issuer_type_valid CHECK (issued_by_type IN ('system','admin','onboarding')),
  ADD CONSTRAINT person_claims_issuer_subject_safe CHECK (length(btrim(issued_by_subject)) BETWEEN 1 AND 200),
  ADD CONSTRAINT person_claims_lookup_id_unique UNIQUE (lookup_id);
