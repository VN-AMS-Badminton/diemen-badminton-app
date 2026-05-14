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
import { RsvpTransferDialog } from "@/components/player/rsvp-transfer-dialog";
import { PaymentBlock } from "@/components/player/payment-block";
import { getPaymentContext } from "@/lib/sessions/get-payment-context";
import { formatDate, formatWeekday } from "@/lib/format";
import type { NextSessionData } from "@/lib/sessions/get-next-session";

interface TransferPlayer {
  id: string;
  username: string;
}

export function NextSessionCard({
  data,
  username,
  subscriptionRow,
  transferablePlayers,
}: {
  data: NextSessionData | null;
  username: string;
  subscriptionRow: { id: string; status: string } | null;
  transferablePlayers: TransferPlayer[];
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {formatWeekday(session.date)} {session.weekday_time.split(" ").slice(-1)[0]}
        </CardTitle>
        <CardDescription>{formatDate(session.date)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* State 1: Subscriber, IN */}
        {subscriberSlot && attendance?.rsvp_status === "in" && (
          <>
            <div className="flex items-center gap-2">
              <Badge variant="success">You&apos;re in</Badge>
              <span className="text-sm text-muted-foreground">
                {confirmedInCount}/{session.capacity} confirmed
              </span>
            </div>
            <RsvpAction
              sessionId={session.id}
              action="opt_out"
              label="Can't make it"
              variant="outline"
            />
            {transferablePlayers.length > 0 && (
              <RsvpTransferDialog
                sessionId={session.id}
                players={transferablePlayers}
              />
            )}
          </>
        )}

        {/* State 2: Subscriber, OPTED OUT */}
        {subscriberSlot && attendance?.rsvp_status === "opted_out" && (
          <>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Opted out</Badge>
              <span className="text-sm text-muted-foreground">
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
              <Badge variant="success">RSVP&apos;d (drop-in)</Badge>
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
              {transferablePlayers.length > 0 && (
                <RsvpTransferDialog
                  sessionId={session.id}
                  players={transferablePlayers}
                />
              )}
            </>
          )}

        {/* State 4: Non-subscriber, available */}
        {!isSubscriber && !attendance && remaining > 0 && (
          <>
            <div className="text-sm text-muted-foreground">
              {remaining} slot{remaining === 1 ? "" : "s"} left of {session.capacity}
            </div>
            <RsvpAction
              sessionId={session.id}
              action="drop_in_rsvp"
              label="RSVP (drop-in)"
            />
          </>
        )}

        {/* State 5: Non-subscriber, full */}
        {!isSubscriber && !attendance && remaining === 0 && (
          <div className="text-sm text-muted-foreground">
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
