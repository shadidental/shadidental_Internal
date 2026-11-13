import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { HistoryList } from "@/components/HistoryList";
import { Badge, Card, Field, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ASSET_STATUS_LABELS, ASSET_STATUS_STYLES, CATEGORY_LABELS } from "@/lib/labels";
import { fmtDate, fmtMoney, todayDate } from "@/lib/format";
import { assignAsset, deleteAsset, returnAsset, setAssetStatus, transferAsset } from "../actions";

export const metadata = { title: "Asset" };

export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("assets:view");
  const { id } = await params;
  const asset = await db.asset.findUnique({
    where: { id },
    include: {
      branch: true, currentOwner: true,
      assignments: { include: { employee: true, assignedBy: true, returnedBy: true }, orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }] },
    },
  });
  if (!asset) notFound();
  const editable = can(user.role, "assets:edit");
  const [history, employees, branches] = await Promise.all([
    db.auditLog.findMany({ where: { entityType: "Asset", entityId: id }, orderBy: { at: "desc" }, take: 100 }),
    editable && asset.status === "IN_STOCK"
      ? db.employee.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, employeeId: true } })
      : Promise.resolve([]),
    editable ? db.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  const today = todayDate().toISOString().slice(0, 10);
  const warrantySoon = asset.warrantyExpiry && asset.warrantyExpiry.getTime() - Date.now() < 30 * 86400_000;

  return (
    <>
      <PageHeader
        title={asset.assetTag}
        subtitle={<>{CATEGORY_LABELS[asset.category]} · {[asset.make, asset.model].filter(Boolean).join(" ") || "No make/model"} · <Badge className={ASSET_STATUS_STYLES[asset.status]}>{ASSET_STATUS_LABELS[asset.status]}</Badge></>}
        actions={editable && <Link className="btn-outline" href={`/assets/${id}/edit`}>Edit details</Link>}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Details">
            <dl className="grid gap-4 sm:grid-cols-3">
              <Field label="Current owner">
                {asset.currentOwner ? <Link className="link" href={`/employees/${asset.currentOwner.id}`}>{asset.currentOwner.fullName} ({asset.currentOwner.employeeId})</Link> : "— (not assigned)"}
              </Field>
              <Field label="Branch">{asset.branch?.name ?? "—"}</Field>
              <Field label="Serial number"><span className="font-mono">{asset.serialNumber ?? "—"}</span></Field>
              <Field label="Vendor">{asset.vendor ?? "—"}</Field>
              <Field label="Purchase date">{fmtDate(asset.purchaseDate)}</Field>
              <Field label="Purchase cost">{fmtMoney(asset.purchaseCost)}</Field>
              <Field label="Invoice ref">{asset.invoiceRef ?? "—"}</Field>
              <Field label="Warranty expiry">
                <span className={warrantySoon ? "font-medium text-amber-700" : ""}>{fmtDate(asset.warrantyExpiry)}</span>
              </Field>
              <Field label="Added">{fmtDate(asset.createdAt)}</Field>
              <div className="sm:col-span-3"><Field label="Condition notes">{asset.conditionNotes ?? "—"}</Field></div>
            </dl>
          </Card>

          <Card title="Owner history">
            {asset.assignments.length === 0 ? (
              <p className="text-sm text-slate-500">Never assigned.</p>
            ) : (
              <div className="-mx-4 overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Employee</th><th>Assigned</th><th>By</th><th>Condition out</th><th>Returned</th><th>By</th><th>Condition in</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {asset.assignments.map((a) => (
                      <tr key={a.id}>
                        <td><Link className="link" href={`/employees/${a.employee.id}`}>{a.employee.fullName}</Link><div className="text-xs text-slate-500">{a.employee.employeeId}</div></td>
                        <td className="whitespace-nowrap">{fmtDate(a.assignedAt)}</td>
                        <td>{a.assignedBy.name}</td>
                        <td>{a.conditionOut ?? "—"}</td>
                        <td className="whitespace-nowrap">{a.returnedAt ? fmtDate(a.returnedAt) : <Badge className="bg-brand-plum-light text-brand-plum">Current</Badge>}</td>
                        <td>{a.returnedBy?.name ?? "—"}</td>
                        <td>{a.conditionIn ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Activity log"><HistoryList entries={history} /></Card>
        </div>

        {editable && (
          <div className="space-y-6">
            {asset.status === "IN_STOCK" && (
              <Card title="Assign to employee">
                <ActionForm action={assignAsset.bind(null, id)} submitLabel="Assign" submitClass="btn-teal">
                  <div>
                    <label className="label" htmlFor="employeeId">Employee</label>
                    <select id="employeeId" name="employeeId" required className="input" defaultValue="">
                      <option value="" disabled>Choose…</option>
                      {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName} ({e.employeeId})</option>)}
                    </select>
                  </div>
                  <div><label className="label" htmlFor="date">Date</label><input id="date" type="date" name="date" defaultValue={today} className="input" required /></div>
                  <div><label className="label" htmlFor="condition">Condition at hand-over</label><input id="condition" name="condition" className="input" placeholder="Good, with charger" /></div>
                </ActionForm>
              </Card>
            )}
            {asset.status === "ASSIGNED" && (
              <Card title="Return / collect">
                <ActionForm action={returnAsset.bind(null, id)} submitLabel="Record return" submitClass="btn-teal">
                  <div><label className="label" htmlFor="rdate">Date</label><input id="rdate" type="date" name="date" defaultValue={today} className="input" required /></div>
                  <div><label className="label" htmlFor="rcond">Condition on return</label><input id="rcond" name="condition" className="input" /></div>
                  <div>
                    <label className="label" htmlFor="newStatus">Goes back to</label>
                    <select id="newStatus" name="newStatus" className="input" defaultValue="IN_STOCK">
                      <option value="IN_STOCK">In stock</option>
                      <option value="UNDER_REPAIR">Under repair</option>
                      <option value="LOST_STOLEN">Not returned – lost / stolen</option>
                    </select>
                  </div>
                </ActionForm>
              </Card>
            )}
            <Card title="Transfer branch">
              <ActionForm action={transferAsset.bind(null, id)} submitLabel="Transfer" submitClass="btn-outline" resetOnSuccess>
                <select name="branchId" className="input" defaultValue="" required>
                  <option value="" disabled>Choose branch…</option>
                  {branches.filter((b) => b.id !== asset.branchId).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <input name="note" className="input" placeholder="Note (optional)" />
              </ActionForm>
            </Card>
            {asset.status !== "ASSIGNED" && (
              <Card title="Change status">
                <ActionForm action={setAssetStatus.bind(null, id)} submitLabel="Update status" submitClass="btn-outline" resetOnSuccess>
                  <select name="status" className="input" defaultValue="" required>
                    <option value="" disabled>Choose…</option>
                    {(["IN_STOCK", "UNDER_REPAIR", "RETIRED", "LOST_STOLEN"] as const).filter((s) => s !== asset.status).map((s) => (
                      <option key={s} value={s}>{ASSET_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                  <input name="note" className="input" placeholder="Reason (optional)" />
                </ActionForm>
              </Card>
            )}
            {can(user.role, "assets:delete") && asset.assignments.length === 0 && (
              <Card title="Delete">
                <p className="mb-3 text-sm text-slate-500">Only for records added by mistake. Use “Retired” for disposed equipment.</p>
                <ActionForm action={async () => { "use server"; return deleteAsset(id); }} submitLabel="Delete asset" submitClass="btn-danger" confirm={`Delete ${asset.assetTag}? This is logged.`}>
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
