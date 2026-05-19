-- Local development seed data.
-- Loaded automatically after migrations on `npm run db:reset` (see db.seed in config.toml).
--
-- Contents:
--   * 20 active players (all role='player'), PIN = 123456 for all
--   * 1 closed season for June 2026 with 4 weekly Thursday sessions
--   * 12 subscription attendance rows (one per subscriber per session) to
--     make admin flows useful. All default to payment_status='assumed_paid'.
--
-- Deterministic UUIDs are used so re-seeded data stays referentially stable
-- across resets and is easy to inspect in Studio.
--
-- Admin user comes from migration 0002_seed_admin.sql (separate concern).

-- ============================================================================
-- 1) PLAYERS — 20 active members, PIN 123456 (bcrypt hash below)
-- ============================================================================

-- Bcrypt hash of PIN "123456" generated via `npm run hash-pin -- 123456`.
-- Safe to commit: hashes are one-way, the cleartext PIN is intended for local dev only.

-- Patch the admin user from migration 0002_seed_admin.sql to use the same
-- local-dev PIN ("123456"). The migration ships with a placeholder hash so
-- production deployers must customize it, but for local dev we want a usable
-- admin login out of the box.
UPDATE players
  SET pin_hash = '$2a$10$b5dzCUYQaOMNj/V6SK36wO.WlPdX0EloHTmZeuLD2sOa2GyCCdF.a'
  WHERE username = 'admin' AND pin_hash = 'PIN_HASH_PLACEHOLDER';

INSERT INTO players (id, username, display_name, whatsapp_number, pin_hash, role, status, referral_code, free_trial_used) VALUES
  ('00000000-0000-0000-0000-000000000001', 'sven',    'Sven Jansen',         '+31600000001', '$2a$10$b5dzCUYQaOMNj/V6SK36wO.WlPdX0EloHTmZeuLD2sOa2GyCCdF.a', 'player', 'active', 'ref-sven-0001',    false),
  ('00000000-0000-0000-0000-000000000002', 'lotte',   'Lotte de Vries',      '+31600000002', '$2a$10$b5dzCUYQaOMNj/V6SK36wO.WlPdX0EloHTmZeuLD2sOa2GyCCdF.a', 'player', 'active', 'ref-lotte-0002',   false),
  ('00000000-0000-0000-0000-000000000003', 'daan',    'Daan Bakker',         '+31600000003', '$2a$10$b5dzCUYQaOMNj/V6SK36wO.WlPdX0EloHTmZeuLD2sOa2GyCCdF.a', 'player', 'active', 'ref-daan-0003',    false),
  ('00000000-0000-0000-0000-000000000004', 'emma',    'Emma van Dijk',       '+31600000004', '$2a$10$b5dzCUYQaOMNj/V6SK36wO.WlPdX0EloHTmZeuLD2sOa2GyCCdF.a', 'player', 'active', 'ref-emma-0004',    false),
  ('00000000-0000-0000-0000-000000000005', 'lars',    'Lars Visser',         '+31600000005', '$2a$10$b5dzCUYQaOMNj/V6SK36wO.WlPdX0EloHTmZeuLD2sOa2GyCCdF.a', 'player', 'active', 'ref-lars-0005',    false),
  ('00000000-0000-0000-0000-000000000006', 'sanne',   'Sanne Smit',          '+31600000006', '$2a$10$b5dzCUYQaOMNj/V6SK36wO.WlPdX0EloHTmZeuLD2sOa2GyCCdF.a', 'player', 'active', 'ref-sanne-0006',   false),
  ('00000000-0000-0000-0000-000000000007', 'bram',    'Bram de Boer',        '+31600000007', '$2a$10$b5dzCUYQaOMNj/V6SK36wO.WlPdX0EloHTmZeuLD2sOa2GyCCdF.a', 'player', 'active', 'ref-bram-0007',    false),
  ('00000000-0000-0000-0000-000000000008', 'iris',    'Iris Mulder',         '+31600000008', '$2a$10$b5dzCUYQaOMNj/V6SK36wO.WlPdX0EloHTmZeuLD2sOa2GyCCdF.a', 'player', 'active', 'ref-iris-0008',    false),
  ('00000000-0000-0000-0000-000000000009', 'finn',    'Finn Meijer',         '+31600000009', '$2a$10$b5dzCUYQaOMNj/V6SK36wO.WlPdX0EloHTmZeuLD2sOa2GyCCdF.a', 'player', 'active', 'ref-finn-0009',    false),
  ('00000000-0000-0000-0000-000000000010', 'noa',     'Noa de Jong',         '+31600000010', '$2a$10$b5dzCUYQaOMNj/V6SK36wO.WlPdX0EloHTmZeuLD2sOa2GyCCdF.a', 'player', 'active', 'ref-noa-0010',     false),
  ('00000000-0000-0000-0000-000000000011', 'tim',     'Tim Peeters',         '+31600000011', '$2a$10$b5dzCUYQaOMNj/V6SK36wO.WlPdX0EloHTmZeuLD2sOa2GyCCdF.a', 'player', 'active', 'ref-tim-0011',     false),
  ('00000000-0000-0000-0000-000000000012', 'anouk',   'Anouk Hendriks',      '+31600000012', '$2a$10$b5dzCUYQaOMNj/V6SK36wO.WlPdX0EloHTmZeuLD2sOa2GyCCdF.a', 'player', 'active', 'ref-anouk-0012',   false),
  ('00000000-0000-0000-0000-000000000013', 'joris',   'Joris van den Berg',  '+31600000013', '$2a$10$b5dzCUYQaOMNj/V6SK36wO.WlPdX0EloHTmZeuLD2sOa2GyCCdF.a', 'player', 'active', 'ref-joris-0013',   false),
  ('00000000-0000-0000-0000-000000000014', 'maud',    'Maud Dekker',         '+31600000014', '$2a$10$b5dzCUYQaOMNj/V6SK36wO.WlPdX0EloHTmZeuLD2sOa2GyCCdF.a', 'player', 'active', 'ref-maud-0014',    false),
  ('00000000-0000-0000-0000-000000000015', 'stijn',   'Stijn Kuijpers',      '+31600000015', '$2a$10$b5dzCUYQaOMNj/V6SK36wO.WlPdX0EloHTmZeuLD2sOa2GyCCdF.a', 'player', 'active', 'ref-stijn-0015',   false),
  ('00000000-0000-0000-0000-000000000016', 'lieke',   'Lieke van Leeuwen',   '+31600000016', '$2a$10$b5dzCUYQaOMNj/V6SK36wO.WlPdX0EloHTmZeuLD2sOa2GyCCdF.a', 'player', 'active', 'ref-lieke-0016',   false),
  ('00000000-0000-0000-0000-000000000017', 'rik',     'Rik de Vos',          '+31600000017', '$2a$10$b5dzCUYQaOMNj/V6SK36wO.WlPdX0EloHTmZeuLD2sOa2GyCCdF.a', 'player', 'active', 'ref-rik-0017',     false),
  ('00000000-0000-0000-0000-000000000018', 'fenna',   'Fenna Bos',           '+31600000018', '$2a$10$b5dzCUYQaOMNj/V6SK36wO.WlPdX0EloHTmZeuLD2sOa2GyCCdF.a', 'player', 'active', 'ref-fenna-0018',   false),
  ('00000000-0000-0000-0000-000000000019', 'bas',     'Bas Hofman',          '+31600000019', '$2a$10$b5dzCUYQaOMNj/V6SK36wO.WlPdX0EloHTmZeuLD2sOa2GyCCdF.a', 'player', 'active', 'ref-bas-0019',     false),
  ('00000000-0000-0000-0000-000000000020', 'eva',     'Eva Willems',         '+31600000020', '$2a$10$b5dzCUYQaOMNj/V6SK36wO.WlPdX0EloHTmZeuLD2sOa2GyCCdF.a', 'player', 'active', 'ref-eva-0020',     false)
ON CONFLICT (username) DO NOTHING;

-- ============================================================================
-- 2) SEASON — June 2026, active, with poll already closed in mid-May
-- ============================================================================

INSERT INTO seasons (
  id, year_month, court_count, subscription_fee_per_session_cents, drop_in_fee_per_session_cents,
  location,
  poll_opens_at, poll_closes_at, status
) VALUES (
  '11111111-1111-1111-1111-000000000001',
  '2026-06',
  2,
  500,    -- €5.00 / session (subscriber rate)
  700,    -- €7.00 / session (drop-in rate)
  'Sporthal Diemen — Court 1+2',
  '2026-05-01 00:00:00+02',
  '2026-05-25 23:59:59+02',
  'closed'
)
ON CONFLICT (year_month) DO NOTHING;

-- ============================================================================
-- 3) SESSIONS — 4 Thursdays in June 2026, 19:00 Europe/Amsterdam, capacity 16
-- ============================================================================

INSERT INTO sessions (
  id, season_id, date, weekday_time, capacity, location, start_at, status
) VALUES
  ('22222222-2222-2222-2222-000000000001',
   '11111111-1111-1111-1111-000000000001',
   '2026-06-04', 'Thu 19:00', 16, 'Sporthal Diemen — Court 1+2',
   ('2026-06-04 19:00:00'::timestamp AT TIME ZONE 'Europe/Amsterdam'),
   'scheduled'),
  ('22222222-2222-2222-2222-000000000002',
   '11111111-1111-1111-1111-000000000001',
   '2026-06-11', 'Thu 19:00', 16, 'Sporthal Diemen — Court 1+2',
   ('2026-06-11 19:00:00'::timestamp AT TIME ZONE 'Europe/Amsterdam'),
   'scheduled'),
  ('22222222-2222-2222-2222-000000000003',
   '11111111-1111-1111-1111-000000000001',
   '2026-06-18', 'Thu 19:00', 16, 'Sporthal Diemen — Court 1+2',
   ('2026-06-18 19:00:00'::timestamp AT TIME ZONE 'Europe/Amsterdam'),
   'scheduled'),
  ('22222222-2222-2222-2222-000000000004',
   '11111111-1111-1111-1111-000000000001',
   '2026-06-25', 'Thu 19:00', 16, 'Sporthal Diemen — Court 1+2',
   ('2026-06-25 19:00:00'::timestamp AT TIME ZONE 'Europe/Amsterdam'),
   'scheduled')
ON CONFLICT (season_id, date) DO NOTHING;

-- ============================================================================
-- 4) SUBSCRIPTION ATTENDANCE — 12 of 20 players subscribed for June 2026.
--    One attendance row per (subscriber × session), source='subscription'.
--    All assumed paid by default (trust-first model).
-- ============================================================================

INSERT INTO attendance (session_id, player_id, source, rsvp_status, payment_status)
SELECT
  s.id,
  p.id,
  'subscription'::attendance_source,
  'in'::rsvp_status,
  'assumed_paid'::payment_status
FROM players p
CROSS JOIN sessions s
WHERE s.season_id = '11111111-1111-1111-1111-000000000001'::uuid
  AND p.username IN (
    'sven','lotte','daan','emma','lars','sanne','bram','iris',
    'finn','noa','tim','anouk'
  )
ON CONFLICT (session_id, player_id) DO NOTHING;
