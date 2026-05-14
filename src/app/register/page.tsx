import { RegisterForm } from "@/components/auth/register-form";

interface PageProps {
  searchParams: Promise<{ code?: string }>;
}

export default async function RegisterPage({ searchParams }: PageProps) {
  const { code } = await searchParams;

  if (!code) {
    return (
      <main className="container mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
        <h1 className="text-2xl font-bold">Invite required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask a club admin for an invite link. It looks like{" "}
          <code>/register?code=...</code>.
        </p>
      </main>
    );
  }

  return (
    <main className="container mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The admin will approve before you can sign in.
        </p>
      </div>
      <RegisterForm inviteCode={code} />
    </main>
  );
}
