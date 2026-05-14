import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export default async function PlayersPage() {
  const sb = createServerSupabase();
  const { data } = await sb
    .from("players")
    .select("id, username, display_name, whatsapp_number, role, status, created_at")
    .order("display_name");

  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Players</h1>
      {rows.length === 0 ? (
        <EmptyState title="No players yet" />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>WhatsApp</TH>
              <TH>Role</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((p) => (
              <TR key={p.id}>
                <TD>
                  <div className="font-medium">{p.display_name || p.username}</div>
                  <div className="text-xs text-muted-foreground">@{p.username}</div>
                </TD>
                <TD className="text-muted-foreground">{p.whatsapp_number}</TD>
                <TD>{p.role}</TD>
                <TD>
                  <Badge
                    variant={
                      p.status === "active"
                        ? "success"
                        : p.status === "pending"
                          ? "warning"
                          : "destructive"
                    }
                  >
                    {p.status}
                  </Badge>
                </TD>
                <TD className="text-right">
                  <Link
                    href={`/admin/players/${p.id}`}
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
    </div>
  );
}
