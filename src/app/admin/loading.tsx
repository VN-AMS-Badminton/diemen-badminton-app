import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Admin overview skeleton: 4 stat tiles + a list block.
export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-16" />
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
