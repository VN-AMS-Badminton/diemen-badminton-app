import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PaymentRowActions } from "@/components/admin/payment-row-actions";
import { SessionTikkieUrlForm } from "@/components/admin/session-tikkie-url-form";
import { SessionEditForm } from "@/components/admin/session-edit-form";
import { RefundSlotButton } from "@/components/admin/refund-slot-button";
import { resolveCutoffIfDue } from "@/lib/sessions/resolve-cutoff";
import { resolvePaymentDeadlines } from "@/lib/sessions/resolve-payment-deadlines";
import { formatDate, formatTime, playerLabel } from "@/lib/format";
import type {
  AttendanceSource,
  PaymentStatus,
  RsvpStatus,
  SessionStatus,
} from "@/lib/db/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminSessionDetail({ params }: Props) {
  const { id } = await params;
  const sb = createServerSupabase();
  // Resolve cutoff + expired drop-in deadlines before reading attendance so
  // admin sees the fully reconciled state.
  await resolveCutoffIfDue(id);
  await resolvePaymentDeadlines(id);
  const { data: sess } = await sb
    .from("sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!sess) notFound();

  type R = {
    id: string;
    source: AttendanceSource;
    rsvp_status: RsvpStatus;
    payment_status: PaymentStatus;
    is_tentative: boolean;
    bumped_at: string | null;
    created_at: string;
    players: {
      username: string;
      display_name: string | null;
      whatsapp_number: string;
      referred_by: string | null;
    } | null;
  };
  const { data } = await sb
    .from("attendance")
    .select(
      "id, source, rsvp_status, payment_status, is_tentative, bumped_at, created_at, players:player_id(username, display_name, whatsapp_number, referred_by)",
    )
    .eq("session_id", id)
    .order("rsvp_status", { ascending: true });
  const rows = (data ?? []) as unknown as R[];
  const attendeeRows = rows.filter((r) => r.rsvp_status !== "waitlisted");
  const waitlistRows = rows
    .filter((r) => r.rsvp_status === "waitlisted")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  // Resolve referrer display names so admin can see who invited each referral.
  const referrerIds = Array.from(
    new Set(
      rows
        .map((r) => r.players?.referred_by)
        .filter((id): id is string => !!id),
    ),
  );
  const referrerById = new Map<string, string>();
  if (referrerIds.length > 0) {
    const { data: refs } = await sb
      .from("players")
      .select("id, display_name")
      .in("id", referrerIds);
    for (const ref of refs ?? []) {
      referrerById.set(ref.id, ref.display_name);
    }
  }

  const confirmed = attendeeRows.filter(
    (r) => r.rsvp_status === "in" && r.bumped_at === null,
  ).length;
  const tentativeCount = attendeeRows.filter(
    (r) => r.rsvp_status === "in" && r.is_tentative && r.bumped_at === null,
  ).length;
  const bumpedCount = attendeeRows.filter((r) => r.bumped_at !== null).length;
  const flagged = attendeeRows.filter(
    (r) => r.rsvp_status === "in" && r.payment_status === "flagged",
  ).length;
  const unpaid = attendeeRows.filter(
    (r) => r.rsvp_status === "in" && r.payment_status === "unpaid",
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
        <h1 className="mt-2 text-2xl font-bold">{formatDate(sess.start_at)}</h1>
        <p className="text-sm text-muted-foreground">
          {formatTime(sess.start_at)}
          {sess.location && (
            <>
              {" · "}
              <MapPin className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden />{" "}
              {sess.location}
            </>
          )}
          {" · "}{confirmed}/{sess.capacity} confirmed · {flagged} flagged
          {unpaid > 0 ? ` · ${unpaid} unpaid` : ""}
          {tentativeCount > 0 ? ` · ${tentativeCount} tentative` : ""}
          {bumpedCount > 0 ? ` · ${bumpedCount} bumped` : ""}
          {waitlistRows.length > 0
            ? ` · ${waitlistRows.length} waitlisted`
            : ""}
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
              start_at: sess.start_at,
              location: sess.location,
              capacity: sess.capacity,
              status: sess.status as SessionStatus,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment link</CardTitle>
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
          {attendeeRows.length === 0 ? (
            <EmptyState title="No attendees yet" />
          ) : (
            <>
              {/* Phone-first card view: stacked rows, no horizontal table scroll. */}
              <div className="space-y-3 md:hidden">
                {attendeeRows.map((r) => {
                  const referrerName = r.players?.referred_by
                    ? referrerById.get(r.players.referred_by)
                    : null;
                  const isReferralGuest = r.source === "referral";
                  const isBumped = !!r.bumped_at;
                  const sourceLabel =
                    r.source === "subscription" ? "sub" : r.source;
                  return (
                    <div
                      key={r.id}
                      className="space-y-2 rounded-md border bg-card px-3 py-2.5 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">
                            {isReferralGuest && r.players?.display_name
                              ? r.players.display_name
                              : r.players
                                ? playerLabel(r.players)
                                : ""}
                          </div>
                          {!isReferralGuest && r.players?.whatsapp_number && (
                            <div className="text-xs text-muted-foreground">
                              {r.players.whatsapp_number}
                            </div>
                          )}
                          {referrerName && (
                            <div className="text-xs text-muted-foreground">
                              guest of {referrerName}
                            </div>
                          )}
                        </div>
                        <Badge
                          variant={
                            r.source === "referral"
                              ? "brand"
                              : r.source === "passed"
                                ? "warning"
                                : "secondary"
                          }
                        >
                          {sourceLabel}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
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
                        <Badge
                          variant={
                            r.payment_status === "flagged"
                              ? "destructive"
                              : r.payment_status === "unpaid"
                                ? "warning"
                                : "success"
                          }
                        >
                          {r.payment_status === "flagged"
                            ? "flagged"
                            : r.payment_status === "unpaid"
                              ? "unpaid"
                              : "assumed paid"}
                        </Badge>
                        {r.is_tentative && !isBumped && (
                          <Badge variant="warning">tentative</Badge>
                        )}
                        {isBumped && (
                          <Badge variant="destructive">bumped</Badge>
                        )}
                      </div>
                      {(r.rsvp_status === "in" ||
                        (isReferralGuest &&
                          (isBumped || r.rsvp_status === "cancelled"))) && (
                        <div className="flex flex-wrap justify-end gap-2 pt-1">
                          {r.rsvp_status === "in" && (
                            <PaymentRowActions
                              attendanceId={r.id}
                              isFlagged={r.payment_status === "flagged"}
                            />
                          )}
                          {isReferralGuest &&
                            (isBumped || r.rsvp_status === "cancelled") && (
                              <RefundSlotButton attendanceId={r.id} />
                            )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop table view: preserved at md+. */}
              <div className="hidden md:block">
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
                    {attendeeRows.map((r) => {
                      const referrerName = r.players?.referred_by
                        ? referrerById.get(r.players.referred_by)
                        : null;
                      const isReferralGuest = r.source === "referral";
                      const isBumped = !!r.bumped_at;
                      return (
                        <TR key={r.id}>
                          <TD>
                            <div className="font-medium">
                              {isReferralGuest && r.players?.display_name
                                ? r.players.display_name
                                : r.players
                                  ? playerLabel(r.players)
                                  : ""}
                            </div>
                            {!isReferralGuest && (
                              <div className="text-xs text-muted-foreground">
                                {r.players?.whatsapp_number}
                              </div>
                            )}
                            {referrerName && (
                              <div className="text-xs text-muted-foreground">
                                guest of {referrerName}
                              </div>
                            )}
                          </TD>
                          <TD>
                            <div className="flex flex-wrap gap-1">
                              <Badge
                                variant={
                                  r.source === "referral"
                                    ? "brand"
                                    : r.source === "passed"
                                      ? "warning"
                                      : "secondary"
                                }
                              >
                                {r.source === "subscription"
                                  ? "sub"
                                  : r.source}
                              </Badge>
                              {r.is_tentative && !isBumped && (
                                <Badge variant="warning">tentative</Badge>
                              )}
                              {isBumped && (
                                <Badge variant="destructive">bumped</Badge>
                              )}
                            </div>
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
                                r.payment_status === "flagged"
                                  ? "destructive"
                                  : r.payment_status === "unpaid"
                                    ? "warning"
                                    : "success"
                              }
                            >
                              {r.payment_status === "flagged"
                                ? "flagged"
                                : r.payment_status === "unpaid"
                                  ? "unpaid"
                                  : "assumed paid"}
                            </Badge>
                          </TD>
                          <TD>
                            <div className="flex flex-col items-end gap-1">
                              {r.rsvp_status === "in" && (
                                <PaymentRowActions
                                  attendanceId={r.id}
                                  isFlagged={r.payment_status === "flagged"}
                                />
                              )}
                              {isReferralGuest &&
                                (isBumped ||
                                  r.rsvp_status === "cancelled") && (
                                  <RefundSlotButton attendanceId={r.id} />
                                )}
                            </div>
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {waitlistRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Waitlist · {waitlistRows.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>#</TH>
                  <TH>Player</TH>
                  <TH>Joined</TH>
                </TR>
              </THead>
              <TBody>
                {waitlistRows.map((r, i) => (
                  <TR key={r.id}>
                    <TD className="tabular-nums">{i + 1}</TD>
                    <TD>
                      <div className="font-medium">{r.players?.username}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.players?.whatsapp_number}
                      </div>
                    </TD>
                    <TD className="text-xs text-muted-foreground">
                      {formatDate(r.created_at.slice(0, 10))}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
