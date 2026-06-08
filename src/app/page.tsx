import { getOptionalSession } from "@/lib/auth/get-session";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function HomePage() {
  const session = await getOptionalSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="relative flex min-h-dvh flex-col justify-center">
      {/* Brand backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-brand/[0.06] via-brand/[0.02] to-transparent"
      />
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="container relative mx-auto flex max-w-md flex-col px-4 py-10">
        <div className="mb-10 text-center">
          <p className="overline mb-2">Smash Pro · Diemen</p>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl">
            Diemen <span className="text-brand">Badminton</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Sign in with your username and PIN.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          a New here? Ask the club admin for an invite link.
        </p>
        <footer className="mt-12 text-center text-xs text-muted-foreground">
          We store your username, WhatsApp number, and payment status. Only the
          club admins can see your contact details.
        </footer>
      </div>
    </main>
  );
}
