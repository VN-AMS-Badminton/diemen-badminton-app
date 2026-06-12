import { createServerSupabase } from "@/lib/supabase/server";
import { resolvePaymentDeadlines } from "@/lib/sessions/resolve-payment-deadlines";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PaymentRowActions } from "@/components/admin/payment-row-actions";
import { formatDate, formatTime } from "@/lib/format";
import type { AttendanceSource, PaymentStatus } from "@/lib/db/types";

const SOURCE_LABEL: Record<AttendanceSource, string> = {
  subscription: "Subscription",
  drop_in: "Drop-in",
  passed: "Passed slot",
  referral: "Referral",
};

export default async function ReconciliationPage() {
  const sb = createServerSupabase();
  const { data: session } = await sb
    .from("sessions")
    .select("*")
    .gte("start_at", new Date().toISOString())
    .eq("status", "scheduled")
    .order("start_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  type AttRow = {
    id: string;
    source: AttendanceSource;
    payment_status: PaymentStatus;
    bunq_payment_id: string | null;
    players: { username: string; whatsapp_number: string | null } | null;
  };
  let attRows: AttRow[] = [];
  if (session) {
    // Sweep expired unpaid drop-ins so the reconciliation list matches reality.
    await resolvePaymentDeadlines(session.id);
    const { data } = await sb
      .from("attendance")
      .select(
        "id, source, payment_status, bunq_payment_id, players:player_id(username, whatsapp_number)",
      )
      .eq("session_id", session.id)
      .eq("rsvp_status", "in")
      .order("source")
      .order("created_at");
    attRows = (data ?? []) as unknown as AttRow[];
  }

  const subscriptionCount = attRows.filter(
    (r) => r.source === "subscription",
  ).length;
  const dropInCount = attRows.filter((r) => r.source === "drop_in").length;
  const otherCount = attRows.length - subscriptionCount - dropInCount;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reconciliation</h1>

      {!session ? (
        <EmptyState title="No upcoming session" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              Next session — {formatDate(session.start_at)} · {formatTime(session.start_at)}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {subscriptionCount} subscribers · {dropInCount} drop-ins
              {otherCount > 0 ? ` · ${otherCount} other` : ""}
            </p>
          </CardHeader>
          <CardContent>
            {attRows.length === 0 ? (
              <EmptyState title="No attendees yet" />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Player</TH>
                    <TH>Source</TH>
                    <TH>Payment</TH>
                    <TH className="text-right">Action</TH>
                  </TR>
                </THead>
                <TBody>
                  {attRows.map((r) => {
                    const isFlagged = r.payment_status === "flagged";
                    const isUnpaid = r.payment_status === "unpaid";
                    const badgeVariant = isFlagged
                      ? "destructive"
                      : isUnpaid
                        ? "warning"
                        : "success";
                    const badgeLabel = isFlagged
                      ? "flagged"
                      : isUnpaid
                        ? "unpaid"
                        : "assumed paid";
                    return (
                      <TR key={r.id}>
                        <TD>
                          <div className="font-medium">
                            {r.players?.username}
                          </div>
                          {r.players?.whatsapp_number && (
                            <div className="text-xs text-muted-foreground">
                              {r.players.whatsapp_number}
                            </div>
                          )}
                        </TD>
                        <TD>{SOURCE_LABEL[r.source] ?? r.source}</TD>
                        <TD>
                          <Badge variant={badgeVariant}>{badgeLabel}</Badge>
                          {r.bunq_payment_id && (
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              paid via bunq{" "}
                              <span className="tabular-nums">
                                {r.bunq_payment_id.slice(-6)}
                              </span>
                            </div>
                          )}
                        </TD>
                        <TD>
                          <PaymentRowActions
                            attendanceId={r.id}
                            isFlagged={isFlagged}
                          />
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
