import { createServerSupabase } from "@/lib/supabase/server";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PaymentRowActions } from "@/components/admin/payment-row-actions";
import { formatDate } from "@/lib/format";

export default async function ReconciliationPage() {
  const sb = createServerSupabase();
  const todayIso = new Date().toISOString().slice(0, 10);

  const { data: session } = await sb
    .from("sessions")
    .select("*")
    .gte("date", todayIso)
    .eq("status", "scheduled")
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();

  // current season for subscription view
  const { data: activeSeason } = await sb
    .from("seasons")
    .select("*")
    .in("status", ["booked", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  type AttRow = {
    id: string;
    payment_status: string;
    source: string;
    players: { username: string; whatsapp_number: string } | null;
  };
  let attRows: AttRow[] = [];
  if (session) {
    const { data } = await sb
      .from("attendance")
      .select(
        "id, payment_status, source, players:player_id(username, whatsapp_number)",
      )
      .eq("session_id", session.id)
      .eq("rsvp_status", "in")
      .order("created_at");
    attRows = (data ?? []) as unknown as AttRow[];
  }

  type SubRow = {
    id: string;
    status: string;
    players: { username: string; whatsapp_number: string } | null;
  };
  let subRows: SubRow[] = [];
  if (activeSeason) {
    const { data } = await sb
      .from("subscriptions")
      .select("id, status, players:player_id(username, whatsapp_number)")
      .eq("season_id", activeSeason.id)
      .in("status", ["confirmed", "paid"])
      .order("created_at");
    subRows = (data ?? []) as unknown as SubRow[];
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Reconciliation</h1>

      {/* Subscriptions section */}
      {activeSeason ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Subscriptions — {activeSeason.year_month}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subRows.length === 0 ? (
              <EmptyState title="No subscribers yet" />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Player</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {subRows.map((s) => (
                    <TR key={s.id}>
                      <TD>
                        <div className="font-medium">{s.players?.username}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.players?.whatsapp_number}
                        </div>
                      </TD>
                      <TD>
                        <Badge
                          variant={
                            s.status === "paid" ? "success" : "warning"
                          }
                        >
                          {s.status}
                        </Badge>
                      </TD>
                      <TD>
                        <PaymentRowActions
                          subscriptionId={s.id}
                          currentStatus={s.status}
                        />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <EmptyState title="No active season" />
      )}

      {/* This-week attendance section */}
      {session ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Next session — {formatDate(session.date)} (drop-ins + week pay)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {attRows.length === 0 ? (
              <EmptyState title="No attendees yet" />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Player</TH>
                    <TH>Source</TH>
                    <TH>Payment</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {attRows.map((r) => (
                    <TR key={r.id}>
                      <TD>
                        <div className="font-medium">{r.players?.username}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.players?.whatsapp_number}
                        </div>
                      </TD>
                      <TD>{r.source}</TD>
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
                      <TD>
                        <PaymentRowActions
                          attendanceId={r.id}
                          currentStatus={r.payment_status}
                        />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <EmptyState title="No upcoming session" />
      )}
    </div>
  );
}
