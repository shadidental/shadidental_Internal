import Link from "next/link";
import type { EmployeeStatus, Prisma } from "@prisma/client";
import { Badge, Card, Empty, PageHeader, Pager } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { EMPLOYEE_STATUS_LABELS } from "@/lib/labels";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Employees" };
const PAGE_SIZE = 50;

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; branch?: string; page?: string }> }) {
  const user = await requireUser("employees:view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.EmployeeWhereInput = {};
  if (sp.q) {
    const q = sp.q.trim();
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { employeeId: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { department: { contains: q, mode: "insensitive" } },
      { jobTitle: { contains: q, mode: "insensitive" } },
    ];
  }
  const status = sp.status ?? "ACTIVE";
  if (status in EMPLOYEE_STATUS_LABELS) where.status = status as EmployeeStatus;
  if (sp.branch) where.branchId = sp.branch;
  const [rows, total, branches] = await Promise.all([
    db.employee.findMany({ where, include: { branch: true, _count: { select: { assetsHeld: true } } }, orderBy: { fullName: "asc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.employee.count({ where }),
    db.branch.findMany({ orderBy: { name: "asc" } }),
  ]);
  const base = new URLSearchParams(Object.entries({ ...sp, status }).filter(([k, v]) => k !== "page" && v) as [string, string][]);
  return (
    <>
      <PageHeader
        title="Employees"
        subtitle={`${total} employee${total === 1 ? "" : "s"}`}
        actions={<>
          <a className="btn-outline" href={`/employees/export?${base}`}>Export CSV</a>
          {can(user.role, "employees:edit") && <Link className="btn-primary" href="/employees/new">+ Add employee</Link>}
        </>}
      />
      <Card>
        <form className="mb-4 grid gap-2 sm:grid-cols-4">
          <input name="q" defaultValue={sp.q} placeholder="Search name, ID, email, department…" className="input sm:col-span-2" />
          <select name="status" defaultValue={status} className="input">
            <option value="ACTIVE">Active</option><option value="LEFT">Left</option><option value="ALL">All</option>
          </select>
          <div className="flex gap-2">
            <select name="branch" defaultValue={sp.branch ?? ""} className="input">
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <button className="btn-teal">Filter</button>
          </div>
        </form>
        {rows.length === 0 ? <Empty>No employees match.</Empty> : (
          <div className="-mx-4 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Name</th><th>Employee ID</th><th>Job title</th><th>Department</th><th>Branch</th><th>Assets</th><th>Start</th><th>Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td><Link className="link" href={`/employees/${e.id}`}>{e.fullName}</Link></td>
                    <td className="font-mono text-xs">{e.employeeId}</td>
                    <td>{e.jobTitle ?? "—"}</td>
                    <td>{e.department ?? "—"}</td>
                    <td>{e.branch?.name ?? "—"}</td>
                    <td>{e._count.assetsHeld}</td>
                    <td className="whitespace-nowrap">{fmtDate(e.startDate)}</td>
                    <td><Badge className={e.status === "ACTIVE" ? "bg-brand-teal-light text-brand-teal-dark" : "bg-slate-200 text-slate-600"}>{EMPLOYEE_STATUS_LABELS[e.status]}</Badge></td>
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
