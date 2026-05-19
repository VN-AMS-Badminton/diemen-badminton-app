import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/format";

export default async function AdminHome() {
  const sb = createServerSupabase();

  const [pending, currentSeason, nextSession] = await Promise.all([
    sb.from("players").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb
      .from("seasons")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from("sessions")
      .select("*")
      .gte("start_at", new Date().toISOString())
      .eq("status", "scheduled")
      .order("start_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  let attendingCount = 0;
  let flaggedCount = 0;
  if (nextSession.data) {
    const id = nextSession.data.id;
    const [att, flagged] = await Promise.all([
      sb
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("session_id", id)
        .eq("rsvp_status", "in"),
      sb
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("session_id", id)
        .eq("rsvp_status", "in")
        .in("payment_status", ["flagged", "unpaid"]),
    ]);
    attendingCount = att.count ?? 0;
    flaggedCount = flagged.count ?? 0;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="overline">Admin</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Overview</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Pending approvals"
          value={pending.count ?? 0}
          href="/admin/approvals"
          linkLabel="Review"
        />
        <StatTile
          label="Current season"
          value={currentSeason.data?.year_month ?? "—"}
          sub={currentSeason.data?.status ?? "no season yet"}
        />
        <StatTile
          label="Next session"
          value={nextSession.data ? formatDate(nextSession.data.start_at) : "—"}
          sub={
            nextSession.data
              ? `${attendingCount} confirmed of ${nextSession.data.capacity}`
              : undefined
          }
        />
        <StatTile
          label="Flagged unpaid"
          value={flaggedCount}
          href="/admin/reconciliation"
          linkLabel="Reconcile"
        />
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  href,
  linkLabel,
}: {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <Card className="transition-shadow hover:shadow-brand">
      <CardContent className="p-5">
        <p className="overline">{label}</p>
        <div className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums">
          {value}
        </div>
        {sub && (
          <div className="mt-1 text-sm text-muted-foreground">{sub}</div>
        )}
        {href && linkLabel && (
          <Link
            href={href}
            className="mt-3 inline-flex items-center text-sm font-semibold text-brand underline-offset-2 hover:underline"
          >
            {linkLabel} →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
