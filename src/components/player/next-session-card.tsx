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
import { formatDate, formatWeekday } from "@/lib/format";
import type { NextSessionData } from "@/lib/sessions/get-next-session";

export function NextSessionCard({
  data,
  username,
  subscriptionRow,
}: {
  data: NextSessionData | null;
  username: string;
  subscriptionRow: { id: string; status: string } | null;
}) {
  if (!data) {
    return (
      <EmptyState
        title="No upcoming session"
        description="When the admin schedules the next week, it'll show up here."
      />
    );
  }

  const { session, season, attendance, confirmedInCount, seasonSessionCount } = data;
  const remaining = Math.max(0, session.capacity - confirmedInCount);
  const isSubscriber =
    !!subscriptionRow &&
    (subscriptionRow.status === "confirmed" || subscriptionRow.status === "paid");
  const subscriberSlot = attendance?.source === "subscription";
  const time = session.weekday_time.split(" ").slice(-1)[0];

  return (
    <Card accent>
      <CardHeader>
        <p className="overline">Next session</p>
        <CardTitle className="text-2xl">
          {formatWeekday(session.date)}{" "}
          <span className="text-brand tabular-nums">{time}</span>
        </CardTitle>
        <CardDescription>{formatDate(session.date)}</CardDescription>
        {session.location && (
          <p className="mt-1 text-sm text-muted-foreground">
            📍 {session.location}
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
                status={
                  attendance.payment_status as
                    | "owed"
                    | "self_marked_paid"
                    | "admin_confirmed"
                }
                target={{ attendanceId: attendance.id }}
                label="Drop-in payment"
              />
              <RsvpAction
                sessionId={session.id}
                action="drop_in_cancel"
                label="Cancel RSVP"
                variant="outline"
              />
              {(attendance.payment_status === "self_marked_paid" ||
                attendance.payment_status === "admin_confirmed") && (
                <PassSlotDialog sessionId={session.id} />
              )}
            </>
          )}

        {/* State 4: Non-subscriber, available (or previously cancelled drop-in) */}
        {!isSubscriber && (!attendance || attendance.rsvp_status === "cancelled") && remaining > 0 && (
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

        {/* State 5: Non-subscriber, full (or previously cancelled drop-in) */}
        {!isSubscriber && (!attendance || attendance.rsvp_status === "cancelled") && remaining === 0 && (
          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            Session is full this week.
          </div>
        )}

        {/* Subscription payment block when applicable */}
        {isSubscriber && subscriberSlot && subscriptionRow && (
          <SubscriptionPaymentBlock
            seasonId={season.id}
            subscriptionId={subscriptionRow.id}
            username={username}
            data={data}
            status={subscriptionRow.status as "confirmed" | "paid"}
          />
        )}
      </CardContent>
    </Card>
  );
}

function SubscriptionPaymentBlock(props: {
  seasonId: string;
  subscriptionId: string;
  username: string;
  data: NextSessionData;
  status: "confirmed" | "paid";
}) {
  const { season } = props.data;
  const { seasonSessionCount } = props.data;
  const ctx = getPaymentContext({
    season,
    scope: "subscription",
    username: props.username,
    sessionCount: seasonSessionCount,
  });
  const paymentStatus: "owed" | "admin_confirmed" =
    props.status === "paid" ? "admin_confirmed" : "owed";
  return (
    <PaymentBlock
      tikkieUrl={ctx.tikkieUrl}
      amountCents={ctx.amountCents}
      username={props.username}
      status={paymentStatus}
      target={{ subscriptionId: props.subscriptionId }}
      label={`Monthly subscription (${season.year_month})`}
    />
  );
}
