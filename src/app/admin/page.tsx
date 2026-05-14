import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";

export default async function AdminHome() {
  const sb = createServerSupabase();

  const todayIso = new Date().toISOString().slice(0, 10);

  const [pending, activeSeason, nextSession] = await Promise.all([
    sb.from("players").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb
      .from("seasons")
      .select("*")
      .in("status", ["poll", "booked", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from("sessions")
      .select("*")
      .gte("date", todayIso)
      .eq("status", "scheduled")
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  let attendingCount = 0;
  let paidCount = 0;
  if (nextSession.data) {
    const id = nextSession.data.id;
    const [att, paid] = await Promise.all([
      sb
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("session_id", id)
        .eq("rsvp_status", "in"),
      sb
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("session_id", id)
        .eq("payment_status", "admin_confirmed"),
    ]);
    attendingCount = att.count ?? 0;
    paidCount = paid.count ?? 0;
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
          value={activeSeason.data?.year_month ?? "—"}
          sub={activeSeason.data?.status ?? "no active season"}
        />
        <StatTile
          label="Next session"
          value={nextSession.data?.date ?? "—"}
          sub={
            nextSession.data
              ? `${attendingCount} confirmed of ${nextSession.data.capacity}`
              : undefined
          }
        />
        <StatTile
          label="Paid this session"
          value={paidCount}
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
