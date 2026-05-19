import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Dashboard skeleton mirrors header + next-session card + refer-link card.
// Heights chosen to keep CLS minimal when real content swaps in.
export default function DashboardLoading() {
  return (
    <main className="container mx-auto max-w-md space-y-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-11 w-11 rounded-md" />
      </header>

      <Card accent>
        <CardHeader className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-11 w-full" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
