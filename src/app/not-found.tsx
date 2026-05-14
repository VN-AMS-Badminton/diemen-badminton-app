import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8 text-center">
      <h1 className="text-3xl font-bold">404</h1>
      <p className="mt-2 text-muted-foreground">Page not found.</p>
      <Link
        href="/"
        className="mt-4 text-primary underline-offset-2 hover:underline"
      >
        ← Home
      </Link>
    </main>
  );
}
