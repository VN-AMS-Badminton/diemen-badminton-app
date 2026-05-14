"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string };

export function AdminNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto max-w-6xl overflow-x-auto px-4">
        <div className="flex min-w-max items-center gap-1 py-2 text-sm">
          {items.map((n) => {
            const active =
              n.href === "/admin"
                ? pathname === "/admin"
                : pathname === n.href || pathname.startsWith(n.href + "/");
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "relative rounded-md px-3 py-1.5 font-semibold transition-colors",
                  active
                    ? "text-brand"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                {n.label}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-2 -bottom-[2px] h-[2px] rounded-full bg-primary"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
