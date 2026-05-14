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
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Profile</h1>
        <Link href="/dashboard" className="text-sm underline-offset-2 hover:underline">
          Back
        </Link>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Username:</span>{" "}
            <span className="font-medium">{player.username}</span>
          </div>
          <div>
            <span className="text-muted-foreground">WhatsApp:</span>{" "}
            <span className="font-medium">{player.whatsapp_number}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Role:</span>{" "}
            <span className="font-medium">{player.role}</span>
          </div>
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
