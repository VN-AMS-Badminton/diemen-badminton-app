import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SessionBatchCreateForm } from "@/components/admin/session-batch-create-form";
import { SessionDeleteButton } from "@/components/admin/session-delete-button";
import { CloseSeasonButton } from "@/components/admin/close-season-button";
import { SeasonEditForm } from "@/components/admin/season-edit-form";
import { listSeasonSubscribers } from "@/lib/seasons/list-season-subscribers";
import { formatDate, formatDateTime, formatTime, playerLabel } from "@/lib/format";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SeasonDetailPage({ params }: Props) {
  const { id } = await params;
  const sb = createServerSupabase();
  const { data: season } = await sb
    .from("seasons")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!season) notFound();

  const { data: sessions } = await sb
    .from("sessions")
    .select("*, attendance(count)")
    .eq("season_id", id)
    .order("start_at");

  type SessionWithCount = {
    id: string;
    start_at: string;
    location: string;
    capacity: number;
    status: string;
    attendance: { count: number }[];
  };
  const sessionRows = (sessions ?? []) as unknown as SessionWithCount[];

  // Subscribers = distinct players with at least one subscription attendance
  // row across this season's sessions. Aggregated paid/flagged/unpaid counts
  // power the "4/5 paid" badge below.
  const subscribers = await listSeasonSubscribers(sb, id);

  const isPoll = season.status === "poll";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/seasons"
          className="text-sm underline-offset-2 hover:underline"
        >
          ← Back to seasons
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{season.year_month}</h1>
        <div className="text-sm text-muted-foreground">
          Status: <Badge>{season.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Poll: {formatDateTime(season.poll_opens_at)} →{" "}
          {formatDateTime(season.poll_closes_at)}
        </p>
        {isPoll && (
          <div className="mt-3">
            <CloseSeasonButton seasonId={season.id} />
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit season</CardTitle>
        </CardHeader>
        <CardContent>
          <SeasonEditForm
            season={{
              id: season.id,
              from_date: season.from_date,
              to_date: season.to_date,
              poll_opens_at: season.poll_opens_at,
              poll_closes_at: season.poll_closes_at,
              court_count: season.court_count,
              location: season.location ?? "",
              weekday: season.weekday,
              start_time: season.start_time,
              end_time: season.end_time,
              subscription_fee_per_session_cents:
                season.subscription_fee_per_session_cents,
              drop_in_fee_per_session_cents:
                season.drop_in_fee_per_session_cents,
              tikkie_url_override: season.tikkie_url_override,
              status: season.status as "poll" | "closed",
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscribers ({subscribers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {subscribers.length === 0 ? (
            <EmptyState title="No subscribers yet" />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Player</TH>
                  <TH>Payment</TH>
                  <TH>When</TH>
                </TR>
              </THead>
              <TBody>
                {subscribers.map((s) => {
                  const fullyPaid =
                    s.flaggedCount === 0 && s.unpaidCount === 0;
                  return (
                    <TR key={s.player_id}>
                      <TD className="font-medium">
                        {playerLabel(s)}
                        {s.whatsapp_number && (
                          <div className="text-xs text-muted-foreground">
                            {s.whatsapp_number}
                          </div>
                        )}
                      </TD>
                      <TD>
                        <Badge variant={fullyPaid ? "success" : "warning"}>
                          {s.paidCount}/{s.totalSessions} paid
                        </Badge>
                        {s.flaggedCount > 0 && (
                          <span className="ml-2 text-xs text-destructive">
                            {s.flaggedCount} flagged
                          </span>
                        )}
                        {s.unpaidCount > 0 && (
                          <span className="ml-2 text-xs text-warning-foreground">
                            {s.unpaidCount} unpaid
                          </span>
                        )}
                      </TD>
                      <TD>{formatDateTime(s.firstSubscribedAt)}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessions ({sessionRows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {sessionRows.length === 0 ? (
            <EmptyState title="No sessions yet" />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Slot</TH>
                  <TH>Location</TH>
                  <TH>Capacity</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {sessionRows.map((s) => {
                  const rsvpCount = s.attendance?.[0]?.count ?? 0;
                  return (
                    <TR key={s.id}>
                      <TD>{formatDate(s.start_at)}</TD>
                      <TD>{formatTime(s.start_at)}</TD>
                      <TD className="text-sm text-muted-foreground">
                        {s.location ?? "—"}
                      </TD>
                      <TD>{s.capacity}</TD>
                      <TD>
                        <Badge>{s.status}</Badge>
                      </TD>
                      <TD className="text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            href={`/admin/sessions/${s.id}`}
                            className="text-sm text-primary underline-offset-2 hover:underline"
                          >
                            Edit
                          </Link>
                          <SessionDeleteButton
                            sessionId={s.id}
                            rsvpCount={rsvpCount}
                            sessionLabel={`${formatDate(s.start_at)} ${formatTime(s.start_at)}`}
                          />
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

      {isPoll && (
        <Card>
          <CardHeader>
            <CardTitle>Add sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Pick the dates this season runs on. Each new session
              automatically gets attendance rows for every existing subscriber.
            </p>
            <SessionBatchCreateForm
              seasonId={season.id}
              yearMonth={season.year_month}
              defaultLocation={season.location}
              defaultWeekday={season.weekday}
              defaultStartTime={season.start_time}
              defaultEndTime={season.end_time}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
