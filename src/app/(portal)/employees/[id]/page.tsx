import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { HistoryList } from "@/components/HistoryList";
import { Badge, Card, Field, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ACCOUNT_STATUS_LABELS, ASSET_STATUS_LABELS, ASSET_STATUS_STYLES, CATEGORY_LABELS, DEFAULT_SYSTEMS, EMPLOYEE_STATUS_LABELS, REQUEST_STATUS_LABELS, REQUEST_STATUS_STYLES, REQUEST_TYPE_LABELS } from "@/lib/labels";
import { fmtDate } from "@/lib/format";
import { addAccount, deleteEmployee, setAccountStatus, setEmployeeStatus } from "../actions";

export const metadata = { title: "Employee" };

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("employees:view");
  const { id } = await params;
  const [e, history] = await Promise.all([db.employee.findFirst({
    where: { id },
    include: {
      branch: true,
      assetsHeld: { orderBy: { assetTag: "asc" } },
      assignments: { include: { asset: true }, orderBy: { assignedAt: "desc" } },
      accounts: { include: { createdBy: true }, orderBy: [{ status: "asc" }, { system: "asc" }] },
      requests: { orderBy: { createdAt: "desc" } },
    },
  }), db.auditLog.findMany({ where: { entityType: "Employee", entityId: id }, orderBy: { at: "desc" }, take: 100 })]);
  if (!e) notFound();
  const editable = can(user.role, "employees:edit");
  const pastAssignments = e.assignments.filter((a) => a.returnedAt);

  return (
    <>
      <PageHeader
        title={e.fullName}
        subtitle={<>{e.employeeId} · {e.jobTitle ?? "No job title"} · <Badge className={e.status === "ACTIVE" ? "bg-brand-teal-light text-brand-teal-dark" : "bg-slate-200 text-slate-600"}>{EMPLOYEE_STATUS_LABELS[e.status]}</Badge></>}
        actions={editable && <Link className="btn-outline" href={`/employees/${id}/edit`}>Edit details</Link>}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Details">
            <dl className="grid gap-4 sm:grid-cols-3">
              <Field label="Email">{e.email ?? "—"}</Field>
              <Field label="Department">{e.department ?? "—"}</Field>
              <Field label="Branch">{e.branch?.name ?? "—"}</Field>
              <Field label="Line manager">{e.lineManager ?? "—"}</Field>
              <Field label="Start date">{fmtDate(e.startDate)}</Field>
              <Field label="End date">{fmtDate(e.endDate)}</Field>
            </dl>
          </Card>

          <Card title={`Assets held now (${e.assetsHeld.length})`}>
            {e.assetsHeld.length === 0 ? <p className="text-sm text-slate-500">None.</p> : (
              <ul className="divide-y divide-slate-100">
                {e.assetsHeld.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                    <span><Link className="link font-mono" href={`/assets/${a.id}`}>{a.assetTag}</Link> · {CATEGORY_LABELS[a.category]} · {[a.make, a.model].filter(Boolean).join(" ")} <span className="font-mono text-xs text-slate-500">{a.serialNumber}</span></span>
                    <Badge className={ASSET_STATUS_STYLES[a.status]}>{ASSET_STATUS_LABELS[a.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
            {pastAssignments.length > 0 && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-slate-500">Previously held ({pastAssignments.length})</summary>
                <ul className="mt-2 space-y-1">
                  {pastAssignments.map((a) => (
                    <li key={a.id}><Link className="link font-mono" href={`/assets/${a.asset.id}`}>{a.asset.assetTag}</Link> · {fmtDate(a.assignedAt)} → {fmtDate(a.returnedAt)}</li>
                  ))}
                </ul>
              </details>
            )}
          </Card>

          <Card title="IT accounts">
            <p className="mb-3 text-xs text-slate-500">Usernames only. Passwords are never stored in the portal.</p>
            {e.accounts.length === 0 ? <p className="text-sm text-slate-500">No accounts recorded.</p> : (
              <div className="-mx-4 overflow-x-auto">
                <table className="table">
                  <thead><tr><th>System</th><th>Username</th><th>Created</th><th>Disabled</th><th>Deleted</th><th>Status</th>{editable && <th></th>}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {e.accounts.map((a) => (
                      <tr key={a.id}>
                        <td>{a.system}</td>
                        <td className="font-mono text-xs">{a.username}</td>
                        <td className="whitespace-nowrap">{fmtDate(a.createdOn)}<div className="text-xs text-slate-500">{a.createdBy?.name}</div></td>
                        <td className="whitespace-nowrap">{fmtDate(a.disabledOn)}</td>
                        <td className="whitespace-nowrap">{fmtDate(a.deletedOn)}</td>
                        <td>{ACCOUNT_STATUS_LABELS[a.status]}</td>
                        {editable && (
                          <td>
                            <ActionForm action={setAccountStatus.bind(null, a.id)} submitLabel="Set" submitClass="btn-outline !px-2 !py-1" className="flex items-center gap-1">
                              <select name="status" defaultValue={a.status} className="input !py-1 !text-xs">
                                {Object.entries(ACCOUNT_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                              </select>
                            </ActionForm>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {editable && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-brand-plum">+ Record an account</summary>
                <ActionForm action={addAccount.bind(null, id)} submitLabel="Save account" submitClass="btn-teal" className="mt-3 grid gap-3 sm:grid-cols-2" resetOnSuccess>
                  <div>
                    <label className="label" htmlFor="system">System</label>
                    <input id="system" name="system" list="systems" required className="input" />
                    <datalist id="systems">{DEFAULT_SYSTEMS.map((s) => <option key={s} value={s} />)}</datalist>
                  </div>
                  <div><label className="label" htmlFor="username">Username</label><input id="username" name="username" required className="input" /></div>
                  <div><label className="label" htmlFor="createdOn">Created on</label><input id="createdOn" name="createdOn" type="date" className="input" /></div>
                  <div><label className="label" htmlFor="notes">Notes (no passwords)</label><input id="notes" name="notes" className="input" /></div>
                </ActionForm>
              </details>
            )}
          </Card>

          <Card title="HR requests">
            {e.requests.length === 0 ? <p className="text-sm text-slate-500">None.</p> : (
              <ul className="divide-y divide-slate-100 text-sm">
                {e.requests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2">
                    <span><Link className="link font-mono" href={`/requests/${r.reference}`}>{r.reference}</Link> · {REQUEST_TYPE_LABELS[r.type]} · {fmtDate(r.createdAt)}</span>
                    <Badge className={REQUEST_STATUS_STYLES[r.status]}>{REQUEST_STATUS_LABELS[r.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Activity log"><HistoryList entries={history} /></Card>
        </div>

        {editable && (
          <div className="space-y-6">
            <Card title="Employment status">
              <ActionForm action={setEmployeeStatus.bind(null, id)} submitLabel={e.status === "ACTIVE" ? "Mark as left" : "Mark as active"} submitClass="btn-outline"
                confirm={e.status === "ACTIVE" ? `Mark ${e.fullName} as left?` : undefined}>
                <input type="hidden" name="status" value={e.status === "ACTIVE" ? "LEFT" : "ACTIVE"} />
                <p className="text-sm text-slate-500">
                  {e.status === "ACTIVE" ? "All assets must be collected first. The full leaver workflow with HR confirmation arrives in Phase 2." : "Re-activate if they re-joined."}
                </p>
              </ActionForm>
            </Card>
            {can(user.role, "employees:delete") && e.assignments.length === 0 && e.accounts.length === 0 && e.requests.length === 0 && (
              <Card title="Delete">
                <p className="mb-3 text-sm text-slate-500">Only for records added by mistake.</p>
                <ActionForm action={async () => { "use server"; return deleteEmployee(id); }} submitLabel="Delete employee" submitClass="btn-danger" confirm={`Delete ${e.fullName}? This is logged.`}>
                  <span />
                </ActionForm>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  );
}
