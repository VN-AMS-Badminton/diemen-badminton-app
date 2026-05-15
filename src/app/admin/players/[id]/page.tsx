import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { PlayerDetail } from "@/components/admin/player-detail";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PlayerDetailPage({ params }: Props) {
  const { id } = await params;
  const sb = createServerSupabase();
  const [{ data: player }, { data: audit }] = await Promise.all([
    sb.from("players").select("*").eq("id", id).maybeSingle(),
    sb
      .from("audit_log")
      .select("*")
      .eq("entity", "player")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (!player) notFound();

  const referrer = player.referred_by
    ? (
        await sb
          .from("players")
          .select("id, username, display_name")
          .eq("id", player.referred_by)
          .maybeSingle()
      ).data
    : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/players"
          className="text-sm underline-offset-2 hover:underline"
        >
          ← Back to players
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{player.username}</h1>
        {referrer && (
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="brand">Referral</Badge>
            <span>
              Invited by{" "}
              <Link
                href={`/admin/players/${referrer.id}`}
                className="underline-offset-2 hover:underline"
              >
                {referrer.display_name || referrer.username}
              </Link>
              {player.free_trial_used
                ? " · free trial used"
                : " · free trial unused"}
            </span>
          </p>
        )}
      </div>
      <PlayerDetail
        player={{
          id: player.id,
          username: player.username,
          whatsapp_number: player.whatsapp_number,
          role: player.role,
          status: player.status,
        }}
      />

      <section>
        <h2 className="mb-3 text-lg font-semibold">Audit history</h2>
        {(audit ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No actions yet.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>When</TH>
                <TH>Action</TH>
                <TH>Actor</TH>
              </TR>
            </THead>
            <TBody>
              {(audit ?? []).map((a) => (
                <TR key={a.id}>
                  <TD>{formatDateTime(a.created_at)}</TD>
                  <TD>{a.action}</TD>
                  <TD className="text-xs text-muted-foreground">
                    {a.actor_id ?? "system"}
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
