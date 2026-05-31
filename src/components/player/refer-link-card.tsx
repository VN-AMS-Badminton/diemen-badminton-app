import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/format";
import type { MyReferralRow, ReferralRowStatus } from "@/lib/referrals/list-my-referrals";
import { RevokeReferralButton } from "@/components/player/revoke-referral-button";

interface Payload {
  referrals: MyReferralRow[];
}

export function ReferLinkCard({ initial }: { initial: Payload }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My referrals</CardTitle>
      </CardHeader>
      <CardContent>
        {initial.referrals.length === 0 ? (
          <EmptyState title="No referrals yet" description="Use the invite button on the next session to bring a guest." />
        ) : (
          <ul className="space-y-1.5">
            {initial.referrals.map((r) => (
              <li
                key={r.attendanceId}
                className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.guestName}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.sessionStartAt ? formatDate(r.sessionStartAt) : "—"}
                  </div>
                </div>
                <StatusChip status={r.status} />
                {r.status === "locked" && (
                  <RevokeReferralButton guestId={r.guestId} guestName={r.guestName} />
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function StatusChip({ status }: { status: ReferralRowStatus }) {
  const map: Record<ReferralRowStatus, { label: string; variant: "success" | "warning" | "secondary" | "brand" | "outline" }> = {
    tentative: { label: "tentative", variant: "brand" },
    locked: { label: "locked", variant: "success" },
    attended: { label: "attended", variant: "success" },
    bumped: { label: "bumped", variant: "warning" },
    cancelled: { label: "cancelled", variant: "secondary" },
  };
  const cfg = map[status];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
