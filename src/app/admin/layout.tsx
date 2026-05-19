import Link from "next/link";
import { requireAdmin } from "@/lib/auth/get-session";
import { LogoutButton } from "@/components/auth/logout-button";
import { AdminNav } from "@/components/admin/admin-nav";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/approvals", label: "Approvals" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/seasons", label: "Seasons" },
  { href: "/admin/sessions", label: "Sessions" },
  { href: "/admin/reconciliation", label: "Reconciliation" },
  { href: "/admin/invites", label: "Invites" },
  { href: "/admin/audit", label: "Audit log" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <div className="min-h-dvh bg-muted/30">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:font-semibold focus:text-foreground focus:shadow-md focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <header className="bg-brand text-brand-foreground shadow-brand">
        <div className="container mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link
            href="/admin"
            className="flex items-center gap-2 font-extrabold tracking-tight"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand-foreground/10 text-sm font-extrabold">
              D
            </span>
            <span>Diemen Admin</span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle onBrand />
            <LogoutButton variant="ghost" onBrand />
          </div>
        </div>
      </header>
      <AdminNav items={NAV} />
      <main id="main" className="container mx-auto max-w-6xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}
