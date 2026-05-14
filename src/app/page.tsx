import { getOptionalSession } from "@/lib/auth/get-session";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";

export default async function HomePage() {
  const session = await getOptionalSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="container mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Diemen Badminton</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with your username and PIN.
        </p>
      </div>
      <LoginForm />
      <p className="mt-6 text-center text-xs text-muted-foreground">
        New here? Ask the club admin for an invite link.
      </p>
      <footer className="mt-12 text-center text-xs text-muted-foreground">
        We store your username, WhatsApp number, and payment status. Only the
        club admins can see your contact details.
      </footer>
    </main>
  );
}
