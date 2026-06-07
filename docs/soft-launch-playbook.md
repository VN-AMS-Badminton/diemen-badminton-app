# Soft Launch Playbook — Diemen Badminton

A 3-phase rollout designed to surface issues with low blast radius before the full club switches over.

## Pre-launch Checklist

- [ ] Supabase project provisioned (free tier)
- [ ] All migrations applied (`0001_init.sql`, `0002_seed_admin.sql` with real values, `0003_rls_policies.sql`, `0004_add_tikkie_url_to_sessions.sql`, `0005_rename_fee_columns_to_per_session.sql`, `0006_add_display_name_to_players.sql`, `0007_add_passed_attendance_source.sql`, `0008_add_location_to_sessions.sql`)
- [ ] Cloudflare Worker deployed (OpenNext), custom domain `vn-ams-badminton.com` configured
- [ ] All env set: Worker secrets (SUPABASE_SECRET_KEY, SESSION_SECRET, PAYMENT_PROVIDER, payment URLs) + build-time `NEXT_PUBLIC_*`
- [ ] First admin login tested end-to-end on a real phone
- [ ] One test invite generated, used to register a test player, approved, logged in, RSVPed (trust-first — no self-mark step)
- [ ] WhatsApp announcement drafted
- [ ] Existing tracking process documented (the spreadsheet or thread) so it can stay as a backup

## Phase A — 2 trusted players (1 week)

Goal: prove the happy path on real devices.

- Send invite link to two trusted regulars
- Run existing process in parallel — don't retire it yet
- Observe their first full RSVP+pay cycle
- Collect feedback in a dedicated WhatsApp DM
- Fix any P1 bugs found

Exit criteria: 2 players completed a full subscribe + RSVP cycle without help (admin flags exceptions out-of-band).

## Phase B — Full club (1 month, parallel)

Goal: full coverage, existing process as safety net.

- Generate invites in batches matching the WhatsApp group
- Post announcement: "We're trialling an app to replace the spreadsheet — please sign up here. The existing process keeps running so nothing breaks."
- Run both processes in parallel for one full monthly cycle (poll → close → 4 weekly sessions)
- Each week: send a friendly reminder if anyone hasn't RSVPed in the app
- Track time spent reconciling: target < 10 min/week

Exit criteria: ≥ 80% of active players have used the app at least once AND admin reconciliation time < 10 min/week for the last 2 weeks.

## Phase C — Cutover (ongoing)

Goal: retire the legacy process.

- Announce: "Starting next month, the app is the single source of truth."
- Keep the spreadsheet read-only for 30 days as a rollback option
- Continue weekly monitoring of:
  - Reconciliation time
  - Payment dispute count
  - Failed-login complaints (PIN forgotten, etc.)

## Rollback Criteria

Roll back to legacy process if **any** of:

- More than 1 payment dispute in a single month
- Admin reconciliation time > 30 min/week for 2 consecutive weeks
- Repeated P1 outages (Supabase down, auth broken) that block weekly cycle

Rollback procedure:
1. Post in WhatsApp: "Reverting to spreadsheet for this week"
2. Re-share latest spreadsheet
3. Continue collecting data in the app in case the issue is recoverable
4. Restore from Supabase daily backup if data corruption suspected (Supabase free auto-backup retains 7 days)

## Monitoring

- **Cloudflare Workers dashboard**: request volume, errors, logs (observability is on)
- **Supabase logs**: review weekly for unexpected error rates
- **Admin audit log**: spot-check for unusual activity
- **Player feedback channel**: keep open in WhatsApp

## Communications Templates

### Announce sign-up (Phase A)
> Hey [name], I'm trialling a small web app to replace the spreadsheet. Could you sign up via this invite link and try it for next Thursday's session? Existing process still works in parallel. Link: <invite-url>

### Announce full launch (Phase B)
> Quick announcement: I built a small app to streamline subscriptions, RSVPs, and payment tracking. Please sign up here: <invite-url>. The existing spreadsheet keeps running — this is purely additive for now. Feedback welcome.

### Announce cutover (Phase C)
> From <month>, the app is the only place to RSVP and mark payments. The spreadsheet is read-only and will be archived end-of-month. If you hit any issue, message me directly.

## Season Flow Smoke Test (trust-first, post-0017)

Run after applying `0017_season_flow_simplification.sql` and deploying. Execute manually on a non-production Supabase project.

1. **Create season** at `/admin/seasons` — fields no longer include weekday/start-time. Season opens in `poll` status.
2. **Open season detail** at `/admin/seasons/[id]` — verify the calendar batch-creator card is shown (no "Book season" form).
3. **Add sessions** — pick 4 days, set time + location + capacity, click "Add 4 sessions". Verify rows appear in the sessions table.
4. **Subscribe as player** — on dashboard, the poll card lists each session and a total. Click Subscribe → attendance rows are created (one per session, `source=subscription`).
5. **Cancel as player** — while the poll is open, the Cancel button removes those rows. Re-subscribe is idempotent.
6. **Close season** — admin clicks "Close season". Status changes to `closed`. Player Subscribe/Cancel buttons disappear.
7. **Reconciliation** — at `/admin/reconciliation`, verify the next session's attendance is grouped by source. Every row defaults to `assumed_paid`; click Flag to toggle to `flagged`.
8. **Drop-in flow** — log in as a non-subscriber. RSVP via drop-in. Tikkie link is shown (informational only — no "I paid" button).
9. **Session history** — players see each attendance row with `paid` or `flagged` badge (no four-state status).
10. **Edit session** at `/admin/sessions/[id]` — date/time/location/capacity changes still work; status guard still rejects `done → scheduled`.

## Open Questions (revisit before launch)

- Final PIN length: 4 for players, 6 for admins?
- Tikkie default URL vs per-season override — confirm default in env
- Capacity formula — courts × 4 default vs explicit per-season override
