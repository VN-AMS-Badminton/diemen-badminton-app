import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  PaymentRowActions,
  BulkConfirmButton,
} from "@/components/admin/payment-row-actions";
import { AttendanceTransferButton } from "@/components/admin/attendance-transfer-button";
import { SessionTikkieUrlForm } from "@/components/admin/session-tikkie-url-form";
import { formatDate } from "@/lib/format";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminSessionDetail({ params }: Props) {
  const { id } = await params;
  const sb = createServerSupabase();
  const { data: sess } = await sb
    .from("sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!sess) notFound();

  type R = {
    id: string;
    player_id: string;
    source: string;
    rsvp_status: string;
    payment_status: string;
    players: { username: string; whatsapp_number: string } | null;
  };
  const [{ data }, { data: allPlayers }] = await Promise.all([
    sb
      .from("attendance")
      .select(
        "id, player_id, source, rsvp_status, payment_status, players:player_id(username, whatsapp_number)",
      )
      .eq("session_id", id)
      .order("rsvp_status", { ascending: true }),
    sb.from("players").select("id, username").eq("status", "active").order("username"),
  ]);
  const rows = (data ?? []) as unknown as R[];

  const confirmed = rows.filter((r) => r.rsvp_status === "in").length;
  const owed = rows.filter(
    (r) => r.rsvp_status === "in" && r.payment_status === "owed",
  ).length;
  const selfMarked = rows.filter(
    (r) => r.rsvp_status === "in" && r.payment_status === "self_marked_paid",
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/sessions"
          className="text-sm underline-offset-2 hover:underline"
        >
          ← Back to sessions
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{formatDate(sess.date)}</h1>
        <p className="text-sm text-muted-foreground">
          {sess.weekday_time} · {confirmed}/{sess.capacity} confirmed · {owed} owed
          · {selfMarked} self-marked
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tikkie link</CardTitle>
        </CardHeader>
        <CardContent>
          <SessionTikkieUrlForm
            sessionId={sess.id}
            currentUrl={sess.tikkie_url ?? null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attendees</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BulkConfirmButton sessionId={sess.id} />
          {rows.length === 0 ? (
            <EmptyState title="No attendees yet" />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Player</TH>
                  <TH>Source</TH>
                  <TH>RSVP</TH>
                  <TH>Payment</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((r) => {
                  const transferCandidates = (allPlayers ?? []).filter(
                    (p) => p.id !== r.player_id,
                  );
                  return (
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
                      <TD className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {r.payment_status !== "n_a" && (
                            <PaymentRowActions
                              attendanceId={r.id}
                              currentStatus={r.payment_status}
                            />
                          )}
                          {r.rsvp_status === "in" && transferCandidates.length > 0 && (
                            <AttendanceTransferButton
                              attendanceId={r.id}
                              fromUsername={r.players?.username ?? ""}
                              players={transferCandidates}
                            />
                          )}
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
