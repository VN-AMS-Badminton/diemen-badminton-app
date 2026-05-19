import { cn } from "@/lib/utils";

// Placeholder block for route- and component-level loading states.
// `motion-reduce:animate-none` keeps reduced-motion users from seeing a pulse.
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted motion-reduce:animate-none",
        className,
      )}
      aria-hidden
    />
  );
}
