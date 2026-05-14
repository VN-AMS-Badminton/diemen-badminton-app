import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

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
      <h1 className="text-2xl font-bold">Overview</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pending.count ?? 0}</div>
            <Link
              href="/admin/approvals"
              className="text-sm text-primary underline-offset-2 hover:underline"
            >
              Review →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current season
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">
              {activeSeason.data?.year_month ?? "—"}
            </div>
            <div className="text-sm text-muted-foreground">
              {activeSeason.data?.status ?? "no active season"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Next session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">
              {nextSession.data?.date ?? "—"}
            </div>
            <div className="text-sm text-muted-foreground">
              {attendingCount} confirmed of {nextSession.data?.capacity ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Paid this session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{paidCount}</div>
            <Link
              href="/admin/reconciliation"
              className="text-sm text-primary underline-offset-2 hover:underline"
            >
              Reconcile →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
