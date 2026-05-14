"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="container mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Try again, or reload the page. If this keeps happening, ping the admin.
      </p>
      <Button onClick={reset} className="mt-4 mx-auto">
        Try again
      </Button>
    </main>
  );
}
