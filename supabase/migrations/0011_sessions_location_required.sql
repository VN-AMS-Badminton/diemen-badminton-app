-- Make sessions.location mandatory: every session must declare its venue so
-- player + referral flows can always render the location.
--
-- Existing NULL rows are backfilled with 'TBD' so the NOT NULL constraint
-- can be applied; admins should edit these via /admin/sessions/<id>.

UPDATE sessions SET location = 'TBD' WHERE location IS NULL;

ALTER TABLE sessions ALTER COLUMN location SET NOT NULL;
