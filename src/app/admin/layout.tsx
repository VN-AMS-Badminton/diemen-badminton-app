import Link from "next/link";
import { requireAdmin } from "@/lib/auth/get-session";
import { LogoutButton } from "@/components/auth/logout-button";

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
    <div className="min-h-dvh">
      <header className="border-b">
        <div className="container mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="font-semibold">
            Diemen Admin
          </Link>
          <LogoutButton variant="ghost" />
        </div>
        <nav className="border-t bg-muted/30">
          <div className="container mx-auto flex max-w-6xl flex-wrap gap-2 px-4 py-2 text-sm">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-md px-2 py-1 hover:bg-muted"
              >
                {n.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main className="container mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
