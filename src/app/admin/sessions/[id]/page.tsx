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
import { SessionTikkieUrlForm } from "@/components/admin/session-tikkie-url-form";
import { SessionEditForm } from "@/components/admin/session-edit-form";
import { formatDate } from "@/lib/format";
import type { SessionStatus } from "@/lib/db/types";

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
    source: string;
    rsvp_status: string;
    payment_status: string;
    players: { username: string; whatsapp_number: string } | null;
  };
  const { data } = await sb
    .from("attendance")
    .select(
      "id, source, rsvp_status, payment_status, players:player_id(username, whatsapp_number)",
    )
    .eq("session_id", id)
    .order("rsvp_status", { ascending: true });
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
          {sess.weekday_time}
          {sess.location ? ` · 📍 ${sess.location}` : ""} · {confirmed}/
          {sess.capacity} confirmed · {owed} owed · {selfMarked} self-marked
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit details</CardTitle>
        </CardHeader>
        <CardContent>
          <SessionEditForm
            session={{
              id: sess.id,
              date: sess.date,
              weekday_time: sess.weekday_time,
              location: sess.location ?? null,
              capacity: sess.capacity,
              status: sess.status as SessionStatus,
            }}
          />
        </CardContent>
      </Card>

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
                {rows.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <div className="font-medium">{r.players?.username}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.players?.whatsapp_number}
                      </div>
                    </TD>
                    <TD>
                      <Badge
                        variant={
                          r.source === "passed" ? "warning" : "secondary"
                        }
                      >
                        {r.source === "subscription" ? "sub" : r.source}
                      </Badge>
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
                    <TD>
                      {r.payment_status !== "n_a" && (
                        <PaymentRowActions
                          attendanceId={r.id}
                          currentStatus={r.payment_status}
                        />
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
