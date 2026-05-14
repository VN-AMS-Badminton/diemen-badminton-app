-- Rename fee columns to make the per-session semantics explicit.
-- subscription_fee_cents was a fixed total; now subscription_fee_per_session_cents
-- is the discounted per-session rate. Total = rate × session_count (computed at display time).
ALTER TABLE seasons
  RENAME COLUMN subscription_fee_cents TO subscription_fee_per_session_cents;

ALTER TABLE seasons
  RENAME COLUMN drop_in_fee_cents TO drop_in_fee_per_session_cents;
