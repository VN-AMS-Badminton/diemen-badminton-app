-- Honor-system payment: trust players when they mark RSVP as paid.
-- Self-marked attendance is now locked-in immediately without admin confirmation.
-- Promote any legacy 'self_marked_paid' rows to 'admin_confirmed' so they show
-- as paid in admin stats and player UI.
UPDATE attendance
SET payment_status = 'admin_confirmed'
WHERE payment_status = 'self_marked_paid';

-- Enum value 'self_marked_paid' is retained for type-system compatibility but
-- is no longer written by application code.
