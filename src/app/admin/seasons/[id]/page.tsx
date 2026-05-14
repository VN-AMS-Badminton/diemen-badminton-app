import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { BookSeasonForm } from "@/components/admin/book-season-form";
import { formatDate, formatDateTime } from "@/lib/format";

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

  type OptInRow = {
    id: string;
    status: string;
    created_at: string;
    players: { username: string; whatsapp_number: string } | null;
  };
  const { data: subs } = await sb
    .from("subscriptions")
    .select(
      "id, status, created_at, players:player_id(username, whatsapp_number)",
    )
    .eq("season_id", id)
    .order("created_at");
  const subRows = (subs ?? []) as unknown as OptInRow[];

  const { data: sessions } = await sb
    .from("sessions")
    .select("*")
    .eq("season_id", id)
    .order("date");

  const canBook = season.status === "poll" || season.status === "booked";

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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Opt-ins ({subRows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {subRows.length === 0 ? (
            <EmptyState title="No opt-ins yet" />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Player</TH>
                  <TH>Status</TH>
                  <TH>When</TH>
                </TR>
              </THead>
              <TBody>
                {subRows.map((s) => (
                  <TR key={s.id}>
                    <TD className="font-medium">{s.players?.username}</TD>
                    <TD>
                      <Badge>{s.status}</Badge>
                    </TD>
                    <TD>{formatDateTime(s.created_at)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canBook && (
        <Card>
          <CardHeader>
            <CardTitle>Book this season</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Set court count, weekday and time. This generates a session for
              every matching weekday of {season.year_month} and confirms all
              opted-in subscribers (auto-RSVP for every generated session).
              Re-running is safe (idempotent).
            </p>
            <BookSeasonForm
              seasonId={season.id}
              defaultSubFee={season.subscription_fee_per_session_cents}
              defaultDropFee={season.drop_in_fee_per_session_cents}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sessions ({sessions?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {(sessions ?? []).length === 0 ? (
            <EmptyState title="No sessions yet" />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Slot</TH>
                  <TH>Capacity</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {(sessions ?? []).map((s) => (
                  <TR key={s.id}>
                    <TD>{formatDate(s.date)}</TD>
                    <TD>{s.weekday_time}</TD>
                    <TD>{s.capacity}</TD>
                    <TD>
                      <Badge>{s.status}</Badge>
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
