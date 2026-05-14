-- Seed the first admin player.
--
-- BEFORE RUNNING:
-- 1. Pick an admin username, WhatsApp number, and a 6-digit PIN.
-- 2. Generate the bcrypt hash locally: `npm run hash-pin -- 123456`
-- 3. Paste the hash into PIN_HASH_PLACEHOLDER below.
-- 4. Update the username + WhatsApp number.
-- 5. Run this migration.
--
-- DO NOT commit the actual PIN — only its hash.

INSERT INTO players (username, whatsapp_number, pin_hash, role, status)
VALUES (
  'admin',                       -- TODO: replace with desired admin username
  '+31600000000',                -- TODO: replace with real WhatsApp number
  'PIN_HASH_PLACEHOLDER',        -- TODO: replace with bcrypt hash from hash-pin
  'admin',
  'active'
)
ON CONFLICT (username) DO NOTHING;
