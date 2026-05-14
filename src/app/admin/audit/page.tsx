import { createServerSupabase } from "@/lib/supabase/server";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";

const PAGE_SIZE = 50;

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function AuditPage({ searchParams }: Props) {
  const { page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const from = (pageNum - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const sb = createServerSupabase();
  const { data, count } = await sb
    .from("audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const rows = data ?? [];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Audit log</h1>
      {rows.length === 0 ? (
        <EmptyState title="No audit entries yet" />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>When</TH>
                <TH>Action</TH>
                <TH>Entity</TH>
                <TH>Entity ID</TH>
                <TH>Actor</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap">
                    {formatDateTime(r.created_at)}
                  </TD>
                  <TD>{r.action}</TD>
                  <TD>{r.entity}</TD>
                  <TD className="font-mono text-xs">{r.entity_id}</TD>
                  <TD className="font-mono text-xs">{r.actor_id ?? "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <div className="flex items-center justify-between text-sm">
            <span>
              Page {pageNum} of {totalPages}
            </span>
            <div className="space-x-2">
              {pageNum > 1 && (
                <a href={`?page=${pageNum - 1}`} className="underline-offset-2 hover:underline">
                  ← Prev
                </a>
              )}
              {pageNum < totalPages && (
                <a href={`?page=${pageNum + 1}`} className="underline-offset-2 hover:underline">
                  Next →
                </a>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
