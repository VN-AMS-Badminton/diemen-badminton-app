import { createServerSupabase } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { InviteForm } from "@/components/admin/invite-form";
import { InviteRevokeButton } from "@/components/admin/invite-revoke-button";
import { formatDateTime } from "@/lib/format";

export default async function InvitesPage() {
  const sb = createServerSupabase();
  const { data } = await sb
    .from("invites")
    .select("*")
    .order("created_at", { ascending: false });
  const rows = data ?? [];
  const nowIso = new Date().toISOString();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Invites</h1>
      <Card>
        <CardHeader>
          <CardTitle>Create invite</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteForm />
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Active invites</h2>
        {rows.length === 0 ? (
          <EmptyState title="No invites yet" />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Code</TH>
                <TH>Uses</TH>
                <TH>Expires</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((i) => {
                const expired = i.expires_at < nowIso;
                const exhausted = i.uses_count >= i.max_uses;
                const active = !i.revoked && !expired && !exhausted;
                return (
                  <TR key={i.id}>
                    <TD className="font-mono text-xs">{i.code}</TD>
                    <TD>
                      {i.uses_count} / {i.max_uses}
                    </TD>
                    <TD>{formatDateTime(i.expires_at)}</TD>
                    <TD>
                      {i.revoked ? (
                        <Badge variant="destructive">revoked</Badge>
                      ) : expired ? (
                        <Badge variant="secondary">expired</Badge>
                      ) : exhausted ? (
                        <Badge variant="secondary">used up</Badge>
                      ) : (
                        <Badge variant="success">active</Badge>
                      )}
                    </TD>
                    <TD className="text-right">
                      {active && <InviteRevokeButton id={i.id} />}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </section>
    </div>
  );
}
