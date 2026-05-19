import { MapPin } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { RsvpAction } from "@/components/player/rsvp-actions";
import { PassSlotDialog } from "@/components/player/pass-slot-dialog";
import { PaymentBlock } from "@/components/player/payment-block";
import { getPaymentContext } from "@/lib/sessions/get-payment-context";
import { formatDate, formatTime, formatWeekday } from "@/lib/format";
import type { NextSessionData } from "@/lib/sessions/get-next-session";

export function NextSessionCard({
  data,
  username,
  waitlist,
}: {
  data: NextSessionData | null;
  username: string;
  waitlist?: { position: number; total: number } | null;
}) {
  if (!data) {
    return (
      <EmptyState
        title="No upcoming session"
        description="When the admin schedules the next week, it'll show up here."
      />
    );
  }

  const { session, season, attendance, confirmedInCount, isSeasonSubscriber } =
    data;
  const remaining = Math.max(0, session.capacity - confirmedInCount);
  const subscriberSlot = attendance?.source === "subscription";
  const isWaitlisted = attendance?.rsvp_status === "waitlisted";
  const time = formatTime(session.start_at);

  return (
    <Card accent>
      <CardHeader>
        <p className="overline">Next session</p>
        <CardTitle className="text-2xl">
          {formatWeekday(session.start_at)}{" "}
          <span className="text-brand tabular-nums">{time}</span>
        </CardTitle>
        <CardDescription>{formatDate(session.start_at)}</CardDescription>
        {session.location && (
          <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {session.location}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* State 1: Subscriber, IN */}
        {subscriberSlot && attendance?.rsvp_status === "in" && (
          <>
            <div className="flex items-center justify-between gap-2">
              <Badge variant="success">You&apos;re in</Badge>
              <span className="text-sm font-medium text-muted-foreground tabular-nums">
                {confirmedInCount}/{session.capacity} confirmed
              </span>
            </div>
            <RsvpAction
              sessionId={session.id}
              action="opt_out"
              label="Can't make it"
              variant="outline"
            />
            <PassSlotDialog sessionId={session.id} />
          </>
        )}

        {/* State 2: Subscriber, OPTED OUT */}
        {subscriberSlot && attendance?.rsvp_status === "opted_out" && (
          <>
            <div className="flex items-center justify-between gap-2">
              <Badge variant="warning">Opted out</Badge>
              <span className="text-sm font-medium text-muted-foreground tabular-nums">
                {confirmedInCount}/{session.capacity} confirmed
              </span>
            </div>
            <RsvpAction
              sessionId={session.id}
              action="opt_in"
              label="I can make it again"
              variant="default"
            />
          </>
        )}

        {/* State 3: Non-subscriber, drop-in already in */}
        {!subscriberSlot &&
          attendance &&
          attendance.rsvp_status === "in" && (
            <>
              <Badge variant="success">RSVP&apos;d · drop-in</Badge>
              <PaymentBlock
                tikkieUrl={
                  getPaymentContext({
                    season,
                    session,
                    scope: "drop_in",
                    username,
                  }).tikkieUrl
                }
                amountCents={season.drop_in_fee_per_session_cents}
                username={username}
                label="Drop-in payment"
                attendanceId={attendance.id}
                status={attendance.payment_status}
                paymentDueAt={attendance.payment_due_at}
              />
              <RsvpAction
                sessionId={session.id}
                action="drop_in_cancel"
                label="Cancel RSVP"
                variant="outline"
              />
              {attendance.payment_status === "unpaid" ? (
                <p className="text-xs text-muted-foreground">
                  Tap <strong>I paid</strong> after sending your Tikkie to
                  unlock passing your slot.
                </p>
              ) : (
                <PassSlotDialog sessionId={session.id} />
              )}
            </>
          )}

        {/* State 4: Non-subscriber, available (or previously cancelled drop-in) */}
        {!isSeasonSubscriber &&
          (!attendance || attendance.rsvp_status === "cancelled") &&
          remaining > 0 && (
            <>
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                <span className="font-bold text-brand tabular-nums">
                  {remaining}
                </span>{" "}
                slot{remaining === 1 ? "" : "s"} left of{" "}
                <span className="tabular-nums">{session.capacity}</span>
              </div>
              <RsvpAction
                sessionId={session.id}
                action="drop_in_rsvp"
                label="RSVP (drop-in)"
              />
            </>
          )}

        {/* State 5: Non-subscriber, full — offer waitlist */}
        {!isSeasonSubscriber &&
          (!attendance || attendance.rsvp_status === "cancelled") &&
          remaining === 0 && (
            <>
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                Session is full this week — join the waitlist and you&apos;ll be
                auto-promoted if a seat opens.
              </div>
              <RsvpAction
                sessionId={session.id}
                action="drop_in_rsvp"
                label="Join waitlist"
                variant="outline"
              />
            </>
          )}

        {/* State 6: Waitlisted */}
        {isWaitlisted && (
          <>
            <div className="flex items-center justify-between gap-2">
              <Badge variant="warning">Waitlisted</Badge>
              {waitlist && waitlist.total > 0 && (
                <span className="text-sm font-medium text-muted-foreground tabular-nums">
                  #{waitlist.position} of {waitlist.total}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              You&apos;ll be auto-promoted if a seat opens. At 24h before the
              session, waitlisted members take priority over tentative guests.
            </p>
            <RsvpAction
              sessionId={session.id}
              action="waitlist_leave"
              label="Leave waitlist"
              variant="outline"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
