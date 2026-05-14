import { requireAdmin } from "@/lib/auth/get-session";
import { createServerSupabase } from "@/lib/supabase/server";
import { ApprovalQueue } from "@/components/admin/approval-queue";

export default async function ApprovalsPage() {
  await requireAdmin();
  const sb = createServerSupabase();
  const { data } = await sb
    .from("players")
    .select("id, username, whatsapp_number, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Pending approvals</h1>
      <p className="text-sm text-muted-foreground">
        Review new registrations. Approving lets them sign in.
      </p>
      <ApprovalQueue players={data ?? []} />
    </div>
  );
}
