import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="container mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 py-8 text-center">
      <p className="overline mb-2">Access denied</p>
      <h1 className="text-5xl font-extrabold tracking-tight text-brand tabular-nums">
        403
      </h1>
      <p className="mt-3 text-muted-foreground">
        You don&apos;t have access to this page.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
      >
        Back to sign in
      </Link>
    </main>
  );
}
