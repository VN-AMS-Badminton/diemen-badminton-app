import { Skeleton } from "@/components/ui/skeleton";

// Referral activation skeleton: banner + calendar grid + button.
export default function ReferLoading() {
  return (
    <main className="container mx-auto max-w-md space-y-5 px-4 py-8">
      <header className="space-y-2 text-center">
        <Skeleton className="mx-auto h-3 w-32" />
        <Skeleton className="mx-auto h-8 w-56" />
        <Skeleton className="mx-auto h-4 w-72" />
      </header>
      <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
        <Skeleton className="h-11 w-full" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
        <Skeleton className="h-11 w-full" />
      </div>
    </main>
  );
}
