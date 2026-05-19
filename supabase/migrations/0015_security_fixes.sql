-- Security fixes for Supabase linter warnings:
--   1. set_updated_at: mutable search_path (function_search_path_mutable)
--   2. resolve_session_cutoff: accessible by anon/authenticated as SECURITY DEFINER

-- Fix 1: Pin search_path so the function cannot be exploited via search_path injection.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- Fix 2: resolve_session_cutoff is only ever called server-side via the service_role
-- client (see src/lib/sessions/resolve-cutoff.ts). Revoke from anon and authenticated.
REVOKE ALL ON FUNCTION resolve_session_cutoff(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION resolve_session_cutoff(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION resolve_session_cutoff(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION resolve_session_cutoff(uuid) TO service_role;
