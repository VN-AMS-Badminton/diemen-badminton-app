import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SeasonForm } from "@/components/admin/season-form";

export default async function SeasonsPage() {
  const sb = createServerSupabase();
  const { data } = await sb
    .from("seasons")
    .select("*")
    .order("year_month", { ascending: false });
  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Seasons</h1>
      <Card>
        <CardHeader>
          <CardTitle>Create season</CardTitle>
        </CardHeader>
        <CardContent>
          <SeasonForm />
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-semibold">All seasons</h2>
        {rows.length === 0 ? (
          <EmptyState title="No seasons yet" />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Year-Month</TH>
                <TH>Status</TH>
                <TH>Courts</TH>
                <TH>Fees (sub / drop)</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((s) => (
                <TR key={s.id}>
                  <TD className="font-medium">{s.year_month}</TD>
                  <TD>
                    <Badge>{s.status}</Badge>
                  </TD>
                  <TD>{s.court_count}</TD>
                  <TD>
                    €{(s.subscription_fee_per_session_cents / 100).toFixed(2)}/session · €
                    {(s.drop_in_fee_per_session_cents / 100).toFixed(2)} drop-in
                  </TD>
                  <TD className="text-right">
                    <Link
                      href={`/admin/seasons/${s.id}`}
                      className="text-sm text-primary underline-offset-2 hover:underline"
                    >
                      Manage
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </section>
    </div>
  );
}
