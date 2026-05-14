import { RegisterForm } from "@/components/auth/register-form";

interface PageProps {
  searchParams: Promise<{ code?: string }>;
}

export default async function RegisterPage({ searchParams }: PageProps) {
  const { code } = await searchParams;

  if (!code) {
    return (
      <main className="container mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
        <p className="overline mb-2">Invite required</p>
        <h1 className="text-2xl font-extrabold tracking-tight">
          You need an invite link
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask a club admin for an invite link. It looks like{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">/register?code=…</code>.
        </p>
      </main>
    );
  }

  return (
    <main className="container mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-6 text-center">
        <p className="overline mb-2">New player</p>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The admin will approve before you can sign in.
        </p>
      </div>
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <RegisterForm inviteCode={code} />
      </div>
    </main>
  );
}
