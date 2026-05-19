"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = { href: string; label: string };

// Below the `lg:` breakpoint, items beyond the primary set collapse into a
// "More" dropdown. Above lg, all items render inline.
const PRIMARY_HREFS = new Set([
  "/admin",
  "/admin/players",
  "/admin/sessions",
  "/admin/seasons",
]);

export function AdminNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  const primary = items.filter((n) => PRIMARY_HREFS.has(n.href));
  const overflow = items.filter((n) => !PRIMARY_HREFS.has(n.href));

  function isActive(href: string) {
    return href === "/admin"
      ? pathname === "/admin"
      : pathname === href || pathname.startsWith(href + "/");
  }

  const overflowActive = overflow.some((n) => isActive(n.href));

  return (
    <nav className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto max-w-6xl overflow-x-auto px-4">
        <div className="flex min-w-max items-center gap-1 py-2 text-sm">
          {primary.map((n) => (
            <NavLink key={n.href} item={n} active={isActive(n.href)} />
          ))}

          {/* Overflow items render inline at lg+, collapsed below */}
          {overflow.map((n) => (
            <NavLink
              key={n.href}
              item={n}
              active={isActive(n.href)}
              className="hidden lg:inline-flex"
            />
          ))}

          {overflow.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-3 py-1.5 font-semibold transition-colors lg:hidden",
                  overflowActive
                    ? "text-brand"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-label="More admin sections"
              >
                More
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {overflow.map((n) => (
                  <DropdownMenuItem key={n.href} asChild>
                    <Link
                      href={n.href}
                      className={cn(
                        "w-full",
                        isActive(n.href) && "font-semibold text-brand",
                      )}
                    >
                      {n.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </nav>
  );
}

function NavLink({
  item,
  active,
  className,
}: {
  item: NavItem;
  active: boolean;
  className?: string;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        "relative rounded-md px-3 py-1.5 font-semibold transition-colors",
        active
          ? "text-brand"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
      aria-current={active ? "page" : undefined}
    >
      {item.label}
      {active && (
        <span
          aria-hidden
          className="absolute inset-x-2 -bottom-[2px] h-[2px] rounded-full bg-primary"
        />
      )}
    </Link>
  );
}
