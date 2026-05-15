import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/format";

export default async function AdminSessionsPage() {
  const sb = createServerSupabase();
  const todayIso = new Date().toISOString().slice(0, 10);

  const [{ data: upcoming }, { data: past }] = await Promise.all([
    sb
      .from("sessions")
      .select("*")
      .gte("date", todayIso)
      .order("date", { ascending: true })
      .limit(50),
    sb
      .from("sessions")
      .select("*")
      .lt("date", todayIso)
      .order("date", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Sessions</h1>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Upcoming</h2>
        {(upcoming ?? []).length === 0 ? (
          <EmptyState title="No upcoming sessions" />
        ) : (
          <SessionTable rows={upcoming ?? []} />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Past (most recent 20)</h2>
        {(past ?? []).length === 0 ? (
          <EmptyState title="No past sessions" />
        ) : (
          <SessionTable rows={past ?? []} />
        )}
      </section>
    </div>
  );
}

interface S {
  id: string;
  date: string;
  weekday_time: string;
  location: string;
  capacity: number;
  status: string;
}
function SessionTable({ rows }: { rows: S[] }) {
  return (
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
        {rows.map((r) => (
          <TR key={r.id}>
            <TD>{formatDate(r.date)}</TD>
            <TD>{r.weekday_time}</TD>
            <TD className="text-sm text-muted-foreground">{r.location ?? "—"}</TD>
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
        ))}
      </TBody>
    </Table>
  );
}
