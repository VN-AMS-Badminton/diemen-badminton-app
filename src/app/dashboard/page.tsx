import Link from "next/link";
import { requireSession } from "@/lib/auth/get-session";
import { createServerSupabase } from "@/lib/supabase/server";
import { getNextSession } from "@/lib/sessions/get-next-session";
import { getActivePoll } from "@/lib/seasons/get-active-poll";
import { NextSessionCard } from "@/components/player/next-session-card";
import { SeasonPollCard } from "@/components/player/season-poll-card";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function DashboardPage() {
  const session = await requireSession();
  const sb = createServerSupabase();

  const [{ data: player }, next, poll] = await Promise.all([
    sb.from("players").select("*").eq("id", session.sub).maybeSingle(),
    getNextSession(session.sub),
    getActivePoll(),
  ]);

  if (!player) {
    return null;
  }

  const pollSubscription = poll
    ? await sb
        .from("subscriptions")
        .select("status")
        .eq("season_id", poll.id)
        .eq("player_id", session.sub)
        .maybeSingle()
        .then((r) => r.data)
    : null;

  // Show poll card while season is in poll phase and player hasn't been confirmed/paid yet.
  const showPoll =
    !!poll &&
    (!pollSubscription ||
      pollSubscription.status === "cancelled" ||
      pollSubscription.status === "opted_in");

  return (
    <main className="container mx-auto max-w-md space-y-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Hi, {player.username}</h1>
          {session.role === "admin" && (
            <Link
              href="/admin"
              className="text-sm text-primary underline-offset-2 hover:underline"
            >
              Admin dashboard
            </Link>
          )}
        </div>
        <LogoutButton />
      </header>

      {showPoll && poll && (
        <SeasonPollCard
          seasonId={poll.id}
          yearMonth={poll.year_month}
          currentStatus={
            pollSubscription?.status === "opted_in"
              ? "opted_in"
              : pollSubscription?.status === "cancelled"
                ? "cancelled"
                : null
          }
        />
      )}

      <NextSessionCard
        data={next}
        username={player.username}
        subscriptionRow={
          next
            ? await sb
                .from("subscriptions")
                .select("id, status")
                .eq("season_id", next.season.id)
                .eq("player_id", session.sub)
                .maybeSingle()
                .then((r) => r.data ?? null)
            : null
        }
      />

      <nav className="flex flex-col gap-2 pt-4 text-sm">
        <Link className="underline-offset-2 hover:underline" href="/profile">
          Profile and PIN
        </Link>
        <Link className="underline-offset-2 hover:underline" href="/sessions/history">
          Session history
        </Link>
      </nav>
    </main>
  );
}
