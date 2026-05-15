# Soft Launch Playbook — Diemen Badminton

A 3-phase rollout designed to surface issues with low blast radius before the full club switches over.

## Pre-launch Checklist

- [ ] Supabase project provisioned (free tier)
- [ ] All migrations applied (`0001_init.sql`, `0002_seed_admin.sql` with real values, `0003_rls_policies.sql`, `0004_add_tikkie_url_to_sessions.sql`, `0005_rename_fee_columns_to_per_session.sql`, `0006_add_display_name_to_players.sql`, `0007_add_passed_attendance_source.sql`, `0008_add_location_to_sessions.sql`)
- [ ] Vercel project deployed, custom domain configured if applicable
- [ ] All env vars set in Vercel (URL, anon key, service role key, session secret, Tikkie URL, app URL)
- [ ] First admin login tested end-to-end on a real phone
- [ ] One test invite generated, used to register a test player, approved, logged in, RSVPed, marked paid
- [ ] WhatsApp announcement drafted
- [ ] Existing tracking process documented (the spreadsheet or thread) so it can stay as a backup

## Phase A — 2 trusted players (1 week)

Goal: prove the happy path on real devices.

- Send invite link to two trusted regulars
- Run existing process in parallel — don't retire it yet
- Observe their first full RSVP+pay cycle
- Collect feedback in a dedicated WhatsApp DM
- Fix any P1 bugs found

Exit criteria: 2 players completed a full RSVP+pay+admin-confirm cycle without help.

## Phase B — Full club (1 month, parallel)

Goal: full coverage, existing process as safety net.

- Generate invites in batches matching the WhatsApp group
- Post announcement: "We're trialling an app to replace the spreadsheet — please sign up here. The existing process keeps running so nothing breaks."
- Run both processes in parallel for one full monthly cycle (poll → book → 4 weekly sessions)
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

- **Vercel Analytics**: traffic + Core Web Vitals
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

## Flexible Session Scheduling Smoke Test

Run after applying `0008_add_location_to_sessions.sql` and deploying the new admin session UI. There is no automated test runner — execute manually on a non-production Supabase project.

1. **Create season** → opt in as a test player → "Book season" with default weekday/time → verify N sessions generated.
2. **Edit session #1** at `/admin/sessions/[id]` — change date, display label, location, capacity. Save. Verify changes persist on `/admin/seasons/[id]`.
3. **Add session** via the "Add a session" card on the season detail page — pick a new date, time, location. Verify it appears and confirmed subscribers get attendance rows auto-created.
4. **Delete session** from the row's Delete button — confirm prompt surfaces RSVP count. Verify session disappears and attendance rows are cascade-removed.
5. **Re-run "Book season"** with same inputs — verify success message reports `skipped M existing` and that no manual edits were touched.
6. **Date collision** — edit a session to a date already used by another session in the same season → expect inline error "Another session already exists on that date".
7. **Status guard** — mark a session `done`, then try to revert it to `scheduled` → expect "Cannot change status of a completed session".
8. **Player view** — log in as a confirmed subscriber. On the dashboard, verify the next-session card shows `📍 <location>` line when set, hidden when null. On `/sessions/history`, verify location renders under the date.

## Open Questions (revisit before launch)

- Final PIN length: 4 for players, 6 for admins?
- Tikkie default URL vs per-season override — confirm default in env
- Capacity formula — courts × 4 default vs explicit per-season override
