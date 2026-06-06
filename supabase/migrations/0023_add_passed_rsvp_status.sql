-- Add 'passed' as a permanent rsvp_status value.
-- Distinguishes "I gave my slot to someone else" (irreversible) from
-- "I opted out for this session" (reversible) and generic "cancelled".
ALTER TYPE rsvp_status ADD VALUE IF NOT EXISTS 'passed';
