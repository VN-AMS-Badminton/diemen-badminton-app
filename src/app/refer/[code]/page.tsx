import { getReferralByCode } from "@/lib/referrals/get-referral-by-code";
import { getRemainingSlots } from "@/lib/referrals/get-remaining-slots";
import { listUpcomingSessionsForReferral } from "@/lib/referrals/list-upcoming-sessions-for-referral";
import { ReferralActivationForm } from "@/components/auth/referral-activation-form";

interface PageProps {
  params: Promise<{ code: string }>;
}

export const dynamic = "force-dynamic";

export default async function ReferActivatePage({ params }: PageProps) {
  const { code } = await params;
  const referral = await getReferralByCode(code);

  if (!referral) {
    return (
      <main className="container mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
        <p className="overline mb-2">Referral link</p>
        <h1 className="text-2xl font-extrabold tracking-tight">
          This link isn&apos;t usable
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The person who shared this link is no longer an active member.
          Ask another member for an invite.
        </p>
      </main>
    );
  }

  const remaining = await getRemainingSlots(referral.referrer.id);
  if (remaining <= 0) {
    return (
      <main className="container mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
        <p className="overline mb-2">Referral link</p>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Out of invites for this month
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">
            {referral.referrer.displayName}
          </span>{" "}
          has used up their referrals for this month. Ask them to share again
          on the 1st of next month.
        </p>
      </main>
    );
  }

  const allSessions = await listUpcomingSessionsForReferral();
  // Sub-24h sessions only show when seats are still available; tentative
  // signups aren't allowed after cutoff, only direct lock-in.
  const sessions = allSessions.filter((s) => !s.subCutoff || !s.full);

  const distinctVenues = Array.from(
    new Set(
      sessions
        .map((s) => s.location)
        .filter((loc): loc is string => !!loc && loc.trim().length > 0),
    ),
  );

  return (
    <main className="container mx-auto max-w-md space-y-5 px-4 py-8">
      <header className="space-y-2 text-center">
        <p className="overline">Free trial referral</p>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Welcome to the club
        </h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">
            {referral.referrer.displayName}
          </span>{" "}
          invited you to try one session for free. Pick a date below — your
          spot is held until 24h before the session.
        </p>
        {distinctVenues.length === 1 && (
          <p className="text-sm text-muted-foreground">
            📍{" "}
            <span className="font-medium text-foreground">
              {distinctVenues[0]}
            </span>
          </p>
        )}
        {distinctVenues.length > 1 && (
          <p className="text-sm text-muted-foreground">
            📍 Multiple venues — see the day details after picking a date.
          </p>
        )}
      </header>
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <ReferralActivationForm
          inviteCode={code}
          referrerName={referral.referrer.displayName}
          sessions={sessions}
        />
      </div>
    </main>
  );
}
