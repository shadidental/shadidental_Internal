import { Card, Empty, PageHeader, Pager } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { fmtDateTime } from "@/lib/format";
import { auditWhere, type AuditFilters } from "./query";

export const metadata = { title: "Audit log" };
const PAGE_SIZE = 100;
const ENTITIES = ["Asset", "Employee", "HrRequest", "PortalUser", "Branch"];
const ACTIONS = ["CREATE", "UPDATE", "DELETE", "ASSIGN", "RETURN", "TRANSFER", "STATUS", "RETIRE", "IMPORT", "EXPORT", "SEND", "COMMENT", "COMPLETE", "CANCEL", "LOGIN", "LOGOUT", "ENABLE", "DISABLE", "MFA_ENROLLED", "MFA_RESET"];

export default async function AuditPage({ searchParams }: { searchParams: Promise<AuditFilters & { page?: string }> }) {
  const user = await requireUser("audit:view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = auditWhere(sp);
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { at: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.auditLog.count({ where }),
  ]);
  const base = new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== "page" && v) as [string, string][]);
  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle={`${total} entries. Entries are append-only: they can't be edited or deleted, even in the database.`}
        actions={can(user.role, "audit:export") && <a className="btn-outline" href={`/audit/export?${base}`}>Export CSV</a>}
      />
      <Card>
        <form className="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
          <input name="q" defaultValue={sp.q} placeholder="Search text…" className="input lg:col-span-2" />
          <select name="entity" defaultValue={sp.entity ?? ""} className="input"><option value="">All records</option>{ENTITIES.map((e) => <option key={e}>{e}</option>)}</select>
          <select name="action" defaultValue={sp.action ?? ""} className="input"><option value="">All actions</option>{ACTIONS.map((a) => <option key={a}>{a}</option>)}</select>
          <input name="actor" defaultValue={sp.actor} placeholder="User email" className="input" />
          <input name="from" type="date" defaultValue={sp.from} className="input" aria-label="From" />
          <div className="flex gap-2"><input name="to" type="date" defaultValue={sp.to} className="input" aria-label="To" /><button className="btn-teal">Go</button></div>
        </form>
        {rows.length === 0 ? <Empty>No entries.</Empty> : (
          <div className="-mx-4 overflow-x-auto">
            <table className="table">
              <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>What</th><th>Changes</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id.toString()}>
                    <td className="whitespace-nowrap text-xs">{fmtDateTime(r.at)}</td>
                    <td className="text-xs">{r.actorEmail ?? "system"}</td>
                    <td><span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">{r.action}</span></td>
                    <td className="text-xs">{r.entityType}</td>
                    <td className="text-sm">{r.summary}</td>
                    <td className="max-w-xs text-xs">
                      {r.before || r.after ? (
                        <details><summary className="cursor-pointer text-brand-plum">view</summary>
                          {r.before != null && <pre className="mt-1 whitespace-pre-wrap rounded bg-red-50 p-1">{JSON.stringify(r.before, null, 1)}</pre>}
                          {r.after != null && <pre className="mt-1 whitespace-pre-wrap rounded bg-emerald-50 p-1">{JSON.stringify(r.after, null, 1)}</pre>}
                        </details>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pages={Math.ceil(total / PAGE_SIZE)} base={base} />
      </Card>
    </>
  );
}
