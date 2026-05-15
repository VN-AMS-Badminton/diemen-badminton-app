import Link from "next/link";
import { requireSession } from "@/lib/auth/get-session";
import { createServerSupabase } from "@/lib/supabase/server";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/format";

export default async function HistoryPage() {
  const session = await requireSession();
  const sb = createServerSupabase();

  const { data } = await sb
    .from("attendance")
    .select(
      "id, rsvp_status, payment_status, source, sessions:session_id(date, weekday_time, location)",
    )
    .eq("player_id", session.sub)
    .order("created_at", { ascending: false });

  type Row = {
    id: string;
    rsvp_status: string;
    payment_status: string;
    source: string;
    sessions: { date: string; weekday_time: string; location: string } | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  return (
    <main className="container mx-auto max-w-2xl space-y-6 px-4 py-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="overline">History</p>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Session history
          </h1>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-brand underline-offset-2 hover:underline"
        >
          ← Back
        </Link>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          description="Your attendance history will show up here."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Source</TH>
                <TH>Status</TH>
                <TH>Payment</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="font-medium">
                    {r.sessions ? formatDate(r.sessions.date) : "—"}
                    {r.sessions?.location && (
                      <div className="text-xs font-normal text-muted-foreground">
                        📍 {r.sessions.location}
                      </div>
                    )}
                  </TD>
                  <TD className="text-muted-foreground">
                    {r.source === "subscription" ? "Subscription" : "Drop-in"}
                  </TD>
                  <TD>
                    <Badge
                      variant={
                        r.rsvp_status === "in"
                          ? "success"
                          : r.rsvp_status === "opted_out"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {r.rsvp_status}
                    </Badge>
                  </TD>
                  <TD>
                    <Badge
                      variant={
                        r.payment_status === "admin_confirmed"
                          ? "success"
                          : r.payment_status === "self_marked_paid"
                            ? "warning"
                            : r.payment_status === "owed"
                              ? "destructive"
                              : "outline"
                      }
                    >
                      {r.payment_status}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </main>
  );
}
