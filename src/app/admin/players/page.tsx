import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export default async function PlayersPage() {
  const sb = createServerSupabase();
  const { data } = await sb
    .from("players")
    .select(
      "id, username, display_name, whatsapp_number, role, status, referred_by, free_trial_used, created_at",
    )
    .order("display_name");

  const rows = data ?? [];

  // Resolve referrer display names so admin can see who invited each referral.
  const referrerIds = Array.from(
    new Set(
      rows.map((p) => p.referred_by).filter((id): id is string => !!id),
    ),
  );
  const referrerById = new Map<string, { displayName: string }>();
  if (referrerIds.length > 0) {
    const { data: refs } = await sb
      .from("players")
      .select("id, display_name")
      .in("id", referrerIds);
    for (const r of refs ?? []) {
      referrerById.set(r.id, { displayName: r.display_name });
    }
  }

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
              <TH>Source</TH>
              <TH>Role</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((p) => {
              const referrer = p.referred_by
                ? referrerById.get(p.referred_by)
                : null;
              return (
                <TR key={p.id}>
                  <TD>
                    <div className="font-medium">
                      {p.display_name || p.username}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      @{p.username}
                    </div>
                  </TD>
                  <TD className="text-muted-foreground">{p.whatsapp_number}</TD>
                  <TD>
                    {referrer ? (
                      <div className="space-y-0.5">
                        <Badge variant="brand">Referral</Badge>
                        <div className="text-xs text-muted-foreground">
                          by {referrer.displayName}
                          {p.free_trial_used ? " · trial used" : " · trial unused"}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Self-registered
                      </span>
                    )}
                  </TD>
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
              );
            })}
          </TBody>
        </Table>
      )}
    </div>
  );
}
