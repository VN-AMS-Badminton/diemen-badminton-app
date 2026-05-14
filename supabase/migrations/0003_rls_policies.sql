-- RLS: deny-all by default. Server actions use the service-role key (which
-- bypasses RLS), and Next.js middleware enforces authn/authz.
-- This file enables RLS as defense-in-depth.

ALTER TABLE players       ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons       ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance    ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log     ENABLE ROW LEVEL SECURITY;

-- No policies created → all `anon` / `authenticated` access is denied.
-- Only the service-role key (used server-side) can read/write.
