-- Simplified referral activation: guest provides only their name to claim the
-- free trial. WhatsApp number is no longer required at signup time, so the
-- column becomes nullable. The existing UNIQUE constraint still allows
-- multiple NULL rows since Postgres treats NULLs as distinct in unique indexes.

ALTER TABLE players ALTER COLUMN whatsapp_number DROP NOT NULL;
