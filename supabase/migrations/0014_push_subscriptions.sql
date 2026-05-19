-- Web Push subscription storage.
-- Server actions use the service-role key (which bypasses RLS).
-- RLS enabled as defense-in-depth (no anon/authenticated policies = deny all).
--
-- Plan: plans/260517-1916-push-notifications-web-push-self-hosted/

CREATE TABLE push_subscriptions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    uuid        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  endpoint     text        NOT NULL,
  p256dh       text        NOT NULL,
  auth         text        NOT NULL,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX push_subscriptions_endpoint_idx ON push_subscriptions(endpoint);
CREATE INDEX        push_subscriptions_player_idx   ON push_subscriptions(player_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
-- No policies: only service-role key may read/write (consistent with 0003_rls_policies.sql).
