-- Drop-in payment gate.
--
-- Trust-first held for subscribers (they pay the season up front), but drop-in
-- RSVPs now start `unpaid` and stay there until the player taps "I paid".
-- Only then can they pass their slot to another member.
--
-- Adds a third value to the payment_status enum. Postgres allows ADD VALUE on
-- an existing enum without the rename-and-recreate dance.

ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'unpaid';
