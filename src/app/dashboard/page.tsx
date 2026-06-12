import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/get-session";
import { createServerSupabase } from "@/lib/supabase/server";
import { getNextSession } from "@/lib/sessions/get-next-session";
import { getActivePoll } from "@/lib/seasons/get-active-poll";
import { NextSessionCard } from "@/components/player/next-session-card";
import { SeasonPollCard } from "@/components/player/season-poll-card";
import { ReferLinkCard } from "@/components/player/refer-link-card";
import { listMyReferrals } from "@/lib/referrals/list-my-referrals";
import { getWaitlistPosition } from "@/lib/waitlist/get-waitlist-position";
import {
  getActiveProvider,
  providerDefaultUrl,
  providerLabel,
} from "@/lib/payments/provider";
import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function DashboardPage() {
  const session = await requireSession();
  const sb = createServerSupabase();

  const [{ data: player }, next, poll] = await Promise.all([
    sb.from("players").select("*").eq("id", session.sub).maybeSingle(),
    getNextSession(session.sub),
    getActivePoll(),
  ]);

  if (!player) {
    // Session JWT is valid but the player row is gone (e.g. DB reseed during dev).
    // Clear the stale cookie and send them back to the login screen instead of
    // rendering a blank page.
    redirect("/api/auth/logout");
  }

  // Sessions for the poll season — we need both the list (to render in the
  // poll card) and the IDs (to test if the player already has subscription
  // attendance rows in this season).
  type PollSession = {
    id: string;
    start_at: string;
    location: string;
  };
  let pollSessions: PollSession[] = [];
  let isSubscribed = false;
  if (poll) {
    const { data } = await sb
      .from("sessions")
      .select("id, start_at, location")
      .eq("season_id", poll.id)
      .eq("status", "scheduled")
      .order("start_at");
    pollSessions = (data ?? []) as PollSession[];

    if (pollSessions.length > 0) {
      const { count } = await sb
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("player_id", session.sub)
        .eq("source", "subscription")
        .in(
          "session_id",
          pollSessions.map((s) => s.id),
        );
      isSubscribed = (count ?? 0) > 0;
    }
  }

  const pollOpen =
    !!poll &&
    poll.status === "poll" &&
    poll.poll_closes_at >= new Date().toISOString();

  // Subscription payment link: season-level override → active provider default.
  const provider = getActiveProvider();
  const payUrl = poll?.tikkie_url_override ?? providerDefaultUrl(provider);

  return (
    <main className="container mx-auto max-w-md space-y-6 px-4 py-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight">
            {player.username}
          </h1>
          {session.role === "admin" && (
            <Link
              href="/admin"
              className="mt-2 inline-flex items-center rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand-soft-foreground hover:bg-brand-soft/80"
            >
              Admin dashboard →
            </Link>
          )}
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </header>

      {poll && (
        <SeasonPollCard
          seasonId={poll.id}
          yearMonth={poll.year_month}
          sessions={pollSessions}
          perSessionCents={poll.subscription_fee_per_session_cents}
          payUrl={payUrl}
          providerLabel={providerLabel(provider)}
          username={player.username}
          displayName={player.display_name}
          isSubscribed={isSubscribed}
          pollOpen={pollOpen}
        />
      )}

      <NextSessionCard
        data={next}
        username={player.username}
        displayName={player.display_name}
        waitlist={
          next ? await getWaitlistPosition(next.session.id, session.sub) : null
        }
      />

      {player.status === "active" && (
        <ReferLinkCard initial={{ referrals: await listMyReferrals(session.sub) }} />
      )}

      <nav className="grid grid-cols-2 gap-2 pt-2">
        <Link
          href="/profile"
          className="rounded-md border bg-card px-4 py-3 text-sm font-semibold transition-colors hover:border-brand/40 hover:bg-accent"
        >
          Profile &amp; PIN
        </Link>
        <Link
          href="/sessions/history"
          className="rounded-md border bg-card px-4 py-3 text-sm font-semibold transition-colors hover:border-brand/40 hover:bg-accent"
        >
          Session history
        </Link>
      </nav>
    </main>
  );
}

