import { Badge } from "@/components/ui/badge";
import type { PaymentStatus } from "@/lib/db/types";

// Single source of truth for rendering payment_status across admin and
// player views. refund_pending = admin cancelled a paid booking; the refund
// settles personally outside the app.
const VARIANT: Record<
  PaymentStatus,
  "success" | "warning" | "destructive"
> = {
  assumed_paid: "success",
  unpaid: "warning",
  flagged: "destructive",
  refund_pending: "warning",
};

const LABEL: Record<PaymentStatus, string> = {
  assumed_paid: "assumed paid",
  unpaid: "unpaid",
  flagged: "flagged",
  refund_pending: "refund pending",
};

export function PaymentStatusBadge({
  status,
  paidLabel,
}: {
  status: PaymentStatus;
  /** Override for the assumed_paid label (player views show "paid"). */
  paidLabel?: string;
}) {
  return (
    <Badge variant={VARIANT[status]}>
      {status === "assumed_paid" && paidLabel ? paidLabel : LABEL[status]}
    </Badge>
  );
}
