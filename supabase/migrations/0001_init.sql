-- Diemen Badminton — initial schema
-- All times stored as timestamptz (UTC); money as integer cents.

-- ENUMS -----------------------------------------------------------------------

CREATE TYPE player_role AS ENUM ('player', 'admin');
CREATE TYPE player_status AS ENUM ('pending', 'active', 'blocked');
CREATE TYPE season_status AS ENUM ('poll', 'booked', 'active', 'closed');
CREATE TYPE subscription_status AS ENUM ('opted_in', 'confirmed', 'paid', 'cancelled');
CREATE TYPE session_status AS ENUM ('scheduled', 'done', 'cancelled');
CREATE TYPE attendance_source AS ENUM ('subscription', 'drop_in');
CREATE TYPE rsvp_status AS ENUM ('in', 'opted_out', 'cancelled');
CREATE TYPE payment_status AS ENUM ('n_a', 'owed', 'self_marked_paid', 'admin_confirmed');

-- updated_at trigger function --------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TABLES ----------------------------------------------------------------------

CREATE TABLE players (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username        text NOT NULL UNIQUE,
  whatsapp_number text NOT NULL UNIQUE,
  pin_hash        text NOT NULL,
  role            player_role NOT NULL DEFAULT 'player',
  status          player_status NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_players_status ON players(status);
CREATE INDEX idx_players_role ON players(role);
CREATE TRIGGER trg_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE seasons (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month             text NOT NULL UNIQUE,
  court_count            int NOT NULL DEFAULT 0,
  subscription_fee_cents int NOT NULL DEFAULT 0,
  drop_in_fee_cents      int NOT NULL DEFAULT 0,
  tikkie_url_override    text,
  poll_opens_at          timestamptz NOT NULL,
  poll_closes_at         timestamptz NOT NULL,
  status                 season_status NOT NULL DEFAULT 'poll',
  created_at             timestamptz NOT NULL DEFAULT NOW(),
  updated_at             timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_seasons_status ON seasons(status);
CREATE INDEX idx_seasons_year_month ON seasons(year_month);
CREATE TRIGGER trg_seasons_updated_at
  BEFORE UPDATE ON seasons
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE subscriptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id       uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  player_id       uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status          subscription_status NOT NULL DEFAULT 'opted_in',
  paid_at         timestamptz,
  marked_by       uuid REFERENCES players(id) ON DELETE SET NULL,
  bunq_payment_id text,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(season_id, player_id)
);
CREATE INDEX idx_subscriptions_season ON subscriptions(season_id);
CREATE INDEX idx_subscriptions_player ON subscriptions(player_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id    uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  date         date NOT NULL,
  weekday_time text NOT NULL,
  capacity     int NOT NULL DEFAULT 0,
  status       session_status NOT NULL DEFAULT 'scheduled',
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  updated_at   timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(season_id, date)
);
CREATE INDEX idx_sessions_season ON sessions(season_id);
CREATE INDEX idx_sessions_date ON sessions(date);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE TRIGGER trg_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE attendance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id       uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  source          attendance_source NOT NULL,
  rsvp_status     rsvp_status NOT NULL DEFAULT 'in',
  payment_status  payment_status NOT NULL DEFAULT 'n_a',
  marked_by       uuid REFERENCES players(id) ON DELETE SET NULL,
  bunq_payment_id text,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, player_id)
);
CREATE INDEX idx_attendance_session ON attendance(session_id);
CREATE INDEX idx_attendance_player ON attendance(player_id);
CREATE INDEX idx_attendance_payment ON attendance(payment_status);
CREATE INDEX idx_attendance_rsvp ON attendance(rsvp_status);
CREATE TRIGGER trg_attendance_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE invites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  max_uses   int NOT NULL DEFAULT 1,
  uses_count int NOT NULL DEFAULT 0,
  revoked    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_invites_code ON invites(code);

CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  actor_id    uuid REFERENCES players(id) ON DELETE SET NULL,
  action      text NOT NULL,
  entity      text NOT NULL,
  entity_id   text NOT NULL,
  before_json jsonb,
  after_json  jsonb,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_entity ON audit_log(entity, entity_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);
