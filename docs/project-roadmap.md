# Project Roadmap

## Now (v1)

Shipped capabilities in the initial release:

- Manual Tikkie payment links + honor-system payment tracking
- Monthly subscription poll for member renewal
- Weekly RSVP system for session attendance
- Referral system for member onboarding
- Permanent slot passing between players
- Web-push notifications for club updates

## Rollout

VN-AMS Badminton is launched via a staged soft launch with limited early access before full rollout. See [soft-launch-playbook.md](./soft-launch-playbook.md) for detail.

## Future

Planned improvements, not yet scheduled:

- Bunq webhook auto-reconciliation (deferred) — automated payment matching to replace manual tracking → [future/bunq-integration.md](./future/bunq-integration.md)
- Make `writeAudit` injectable for testability — refactor Supabase audit writes to support dependency injection in tests → [future/refactor-write-audit-injectable-sb.md](./future/refactor-write-audit-injectable-sb.md)
- Increase automated test coverage — currently minimal; expand unit and integration tests across critical flows
