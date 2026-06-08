import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { countOccupiedBySession } from "@/lib/sessions/count-occupied-by-session";
import { formatDate, formatTime } from "@/lib/format";

export default async function AdminSessionsPage() {
  const sb = createServerSupabase();
  const now = new Date().toISOString();

  const [{ data: upcoming }, { data: past }] = await Promise.all([
    sb
      .from("sessions")
      .select("*")
      .gte("start_at", now)
      .order("start_at", { ascending: true })
      .limit(50),
    sb
      .from("sessions")
      .select("*")
      .lt("start_at", now)
      .order("start_at", { ascending: false })
      .limit(20),
  ]);

  // Occupied seats per session = confirmed ('in') RSVPs, for the "Occupied"
  // column below. One batched query covers both upcoming and past tables.
  const allRows = [...(upcoming ?? []), ...(past ?? [])];
  const occupiedBySession = await countOccupiedBySession(
    sb,
    allRows.map((r) => r.id),
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Sessions</h1>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Upcoming</h2>
        {(upcoming ?? []).length === 0 ? (
          <EmptyState title="No upcoming sessions" />
        ) : (
          <SessionTable rows={upcoming ?? []} occupied={occupiedBySession} />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Past (most recent 20)</h2>
        {(past ?? []).length === 0 ? (
          <EmptyState title="No past sessions" />
        ) : (
          <SessionTable rows={past ?? []} occupied={occupiedBySession} />
        )}
      </section>
    </div>
  );
}

interface S {
  id: string;
  start_at: string;
  location: string;
  capacity: number;
  status: string;
}
function SessionTable({
  rows,
  occupied,
}: {
  rows: S[];
  occupied: Map<string, number>;
}) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Date</TH>
          <TH>Slot</TH>
          <TH>Location</TH>
          <TH>Occupied</TH>
          <TH>Capacity</TH>
          <TH>Status</TH>
          <TH className="text-right">Actions</TH>
        </TR>
      </THead>
      <TBody>
        {rows.map((r) => {
          const filled = occupied.get(r.id) ?? 0;
          return (
          <TR key={r.id}>
            <TD>{formatDate(r.start_at)}</TD>
            <TD>{formatTime(r.start_at)}</TD>
            <TD className="text-sm text-muted-foreground">{r.location ?? "—"}</TD>
            <TD>
              <span className={filled >= r.capacity ? "font-medium text-success" : undefined}>
                {filled}
              </span>
            </TD>
            <TD>{r.capacity}</TD>
            <TD>
              <Badge>{r.status}</Badge>
            </TD>
            <TD className="text-right">
              <Link
                href={`/admin/sessions/${r.id}`}
                className="text-sm text-primary underline-offset-2 hover:underline"
              >
                Open
              </Link>
            </TD>
          </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
