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
      "id, rsvp_status, payment_status, source, sessions:session_id(date, weekday_time)",
    )
    .eq("player_id", session.sub)
    .order("created_at", { ascending: false });

  type Row = {
    id: string;
    rsvp_status: string;
    payment_status: string;
    source: string;
    sessions: { date: string; weekday_time: string } | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  return (
    <main className="container mx-auto max-w-2xl space-y-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Session history</h1>
        <Link href="/dashboard" className="text-sm underline-offset-2 hover:underline">
          Back
        </Link>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          description="Your attendance history will show up here."
        />
      ) : (
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
                <TD>{r.sessions ? formatDate(r.sessions.date) : "—"}</TD>
                <TD>{r.source === "subscription" ? "Subscription" : "Drop-in"}</TD>
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
      )}
    </main>
  );
}
