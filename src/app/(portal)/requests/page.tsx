import Link from "next/link";
import type { HrRequestStatus, HrRequestType, Prisma } from "@prisma/client";
import { Badge, Card, Empty, PageHeader, Pager } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { REQUEST_STATUS_LABELS, REQUEST_STATUS_STYLES, REQUEST_TYPE_LABELS } from "@/lib/labels";
import { fmtDate, fmtDateTime } from "@/lib/format";

export const metadata = { title: "HR requests" };
const PAGE_SIZE = 50;

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ status?: string; type?: string; q?: string; mine?: string; page?: string }> }) {
  const user = await requireUser("requests:view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = sp.status ?? "OPEN";
  const where: Prisma.HrRequestWhereInput = {};
  if (status === "OPEN") where.status = { in: ["SUBMITTED", "IN_PROGRESS"] };
  else if (status in REQUEST_STATUS_LABELS) where.status = status as HrRequestStatus;
  if (sp.type && sp.type in REQUEST_TYPE_LABELS) where.type = sp.type as HrRequestType;
  if (sp.mine === "1") where.OR = [{ raisedById: user.id }, { assignedToId: user.id }];
  if (sp.q) {
    const q = sp.q.trim();
    where.AND = [{ OR: [
      { reference: { contains: q, mode: "insensitive" } },
      { employeeName: { contains: q, mode: "insensitive" } },
      { employeeNumber: { contains: q, mode: "insensitive" } },
    ] }];
  }
  const [rows, total] = await Promise.all([
    db.hrRequest.findMany({ where, include: { raisedBy: true, assignedTo: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.hrRequest.count({ where }),
  ]);
  const base = new URLSearchParams(Object.entries({ ...sp, status }).filter(([k, v]) => k !== "page" && v) as [string, string][]);
  return (
    <>
      <PageHeader
        title={user.role === "HR" ? "Requests to IT" : "HR requests"}
        subtitle={`${total} request${total === 1 ? "" : "s"}`}
        actions={can(user.role, "requests:create") && <Link className="btn-primary" href="/requests/new">+ New request</Link>}
      />
      <Card>
        <form className="mb-4 grid gap-2 sm:grid-cols-5">
          <input name="q" defaultValue={sp.q} placeholder="Search reference or name…" className="input sm:col-span-2" />
          <select name="status" defaultValue={status} className="input">
            <option value="OPEN">Open</option>
            {Object.entries(REQUEST_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            <option value="ALL">All</option>
          </select>
          <select name="type" defaultValue={sp.type ?? ""} className="input">
            <option value="">All types</option>
            {Object.entries(REQUEST_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="mine" value="1" defaultChecked={sp.mine === "1"} /> Mine</label>
            <button className="btn-teal">Filter</button>
          </div>
        </form>
        {rows.length === 0 ? <Empty>No requests.</Empty> : (
          <div className="-mx-4 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Reference</th><th>Type</th><th>Employee</th><th>Date needed</th><th>Raised by</th><th>Raised</th><th>IT owner</th><th>Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><Link className="link font-mono" href={`/requests/${r.reference}`}>{r.reference}</Link></td>
                    <td>{REQUEST_TYPE_LABELS[r.type]}</td>
                    <td>{r.employeeName}{r.employeeNumber && <div className="text-xs text-slate-500">{r.employeeNumber}</div>}</td>
                    <td className="whitespace-nowrap">{fmtDate(r.effectiveDate)}</td>
                    <td>{r.raisedBy.name}</td>
                    <td className="whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                    <td>{r.assignedTo?.name ?? "—"}</td>
                    <td><Badge className={REQUEST_STATUS_STYLES[r.status]}>{REQUEST_STATUS_LABELS[r.status]}</Badge></td>
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
