import Link from "next/link";
import { requireSession } from "@/lib/auth/get-session";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePinForm } from "@/components/player/change-pin-form";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function ProfilePage() {
  const session = await requireSession();
  const sb = createServerSupabase();
  const { data: player } = await sb
    .from("players")
    .select("*")
    .eq("id", session.sub)
    .maybeSingle();

  if (!player) return null;

  return (
    <main className="container mx-auto max-w-md space-y-6 px-4 py-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="overline">Account</p>
          <h1 className="text-2xl font-extrabold tracking-tight">Profile</h1>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-brand underline-offset-2 hover:underline"
        >
          ← Back
        </Link>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ProfileRow label="Username" value={player.username} />
          <ProfileRow label="WhatsApp" value={player.whatsapp_number} />
          <ProfileRow label="Role" value={player.role} />
          <p className="pt-2 text-xs text-muted-foreground">
            Need to change your WhatsApp number? Ask the admin.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change PIN</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePinForm />
        </CardContent>
      </Card>

      <LogoutButton />
    </main>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
