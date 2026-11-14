import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { HistoryList } from "@/components/HistoryList";
import { Badge, Card, Field, Notice, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { REQUEST_STATUS_LABELS, REQUEST_STATUS_STYLES, REQUEST_TYPE_DATE_LABEL, REQUEST_TYPE_LABELS } from "@/lib/labels";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { addComment, assignRequest, closeRequest, retryEmail, withdrawRequest } from "../actions";

export const metadata = { title: "Request" };

export default async function RequestPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<{ sent?: string; closed?: string; withdrawn?: string }> }) {
  const user = await requireUser("requests:view");
  const { ref } = await params;
  const { sent, closed, withdrawn } = await searchParams;
  const r = await db.hrRequest.findFirst({
    where: { reference: decodeURIComponent(ref) },
    include: {
      raisedBy: true, assignedTo: true, employee: true,
      comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
      emails: { include: { sentBy: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!r) notFound();
  const isIT = can(user.role, "requests:work");
  const open = r.status === "SUBMITTED" || r.status === "IN_PROGRESS";
  const [history, itUsers] = await Promise.all([
    can(user.role, "audit:view") ? db.auditLog.findMany({ where: { entityType: "HrRequest", entityId: r.id }, orderBy: { at: "desc" } }) : Promise.resolve([]),
    isIT ? db.portalUser.findMany({ where: { active: true, role: { in: ["ADMIN", "IT_STAFF"] } }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title={`${r.reference} · ${REQUEST_TYPE_LABELS[r.type]}`}
        subtitle={<>{r.employeeName} · raised by {r.raisedBy.name} on {fmtDateTime(r.createdAt)} · <Badge className={REQUEST_STATUS_STYLES[r.status]}>{REQUEST_STATUS_LABELS[r.status]}</Badge></>}
        actions={<Link className="btn-outline" href="/requests">All requests</Link>}
      />
      {sent === "1" && <Notice>Request submitted. IT has been emailed and you are in copy.</Notice>}
      {closed === "1" && <Notice>Request closed. HR has been emailed the confirmation, and a copy is stored below.</Notice>}
      {closed === "0" && <Notice tone="warn">Request closed, but the confirmation email failed. Open it in the email record below and click Retry.</Notice>}
      {withdrawn === "1" && <Notice>Request withdrawn. IT has been notified by email.</Notice>}
      {sent === "0" && <Notice tone="warn">Request saved, but the email to IT failed. IT can still see it here; they can retry the email below.</Notice>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Request details">
            <dl className="grid gap-4 sm:grid-cols-3">
              <Field label="Employee">
                {r.employee && can(user.role, "employees:view") ? <Link className="link" href={`/employees/${r.employee.id}`}>{r.employeeName}</Link> : r.employeeName}
              </Field>
              <Field label="Employee ID">{r.employeeNumber ?? "—"}</Field>
              <Field label={REQUEST_TYPE_DATE_LABEL[r.type]}>{fmtDate(r.effectiveDate)}</Field>
              <Field label="Job title">{r.jobTitle ?? "—"}</Field>
              <Field label="Department">{r.department ?? "—"}</Field>
              <Field label="Branch">{r.branchName ?? "—"}</Field>
              <Field label="Line manager">{r.lineManager ?? "—"}</Field>
              <Field label="IT owner">{r.assignedTo?.name ?? "Not yet assigned"}</Field>
              <Field label="Closed">{fmtDateTime(r.completedAt)}</Field>
              <div className="sm:col-span-3"><Field label="Details / requirements"><span className="whitespace-pre-wrap">{r.details ?? "—"}</span></Field></div>
            </dl>
          </Card>

          <Card title="Conversation">
            {r.comments.length === 0 ? <p className="text-sm text-slate-500">No comments yet.</p> : (
              <ul className="space-y-3">
                {r.comments.map((c) => (
                  <li key={c.id} className={`rounded-lg px-4 py-3 text-sm ${c.author.role === "HR" ? "bg-brand-plum-light" : "bg-brand-teal-light"}`}>
                    <p className="mb-1 text-xs text-slate-500"><b className="text-slate-700">{c.author.name}</b> ({c.author.role === "HR" ? "HR" : "IT"}) · {fmtDateTime(c.createdAt)}</p>
                    <p className="whitespace-pre-wrap">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
            {can(user.role, "requests:comment") && (
              <ActionForm action={addComment.bind(null, r.id)} submitLabel="Add comment" submitClass="btn-outline" className="mt-4 space-y-2" resetOnSuccess>
                <textarea name="body" rows={3} className="input" placeholder="Ask a question or post an update (no passwords)…" />
              </ActionForm>
            )}
          </Card>

          <Card title="Official email record">
            <p className="mb-3 text-xs text-slate-500">Every email the portal sends for this request is stored here exactly as sent and cannot be edited or deleted.</p>
            {r.emails.length === 0 ? <p className="text-sm text-slate-500">No emails.</p> : (
              <ul className="space-y-3">
                {r.emails.map((m) => (
                  <li key={m.id} className="rounded-md border border-slate-200">
                    <details>
                      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                        <span className="font-medium">{m.subject}</span>
                        <span className="flex items-center gap-2 text-xs text-slate-500">
                          {fmtDateTime(m.sentAt ?? m.createdAt)}
                          <Badge className={m.status === "SENT" ? "bg-emerald-100 text-emerald-800" : m.status === "FAILED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}>{m.status}</Badge>
                        </span>
                      </summary>
                      <div className="border-t border-slate-200 px-4 py-3 text-xs">
                        <p><b>From:</b> {m.fromAddress}</p>
                        <p><b>To:</b> {m.toAddresses.join(", ")}</p>
                        {m.ccAddresses.length > 0 && <p><b>Cc:</b> {m.ccAddresses.join(", ")}</p>}
                        <p><b>Sent by:</b> {m.sentBy?.name ?? "system"} · <b>Transport:</b> {m.transport}{m.messageId && <> · <b>Message-ID:</b> {m.messageId}</>}</p>
                        {m.error && <p className="text-red-700"><b>Error:</b> {m.error}</p>}
                        <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-3 font-sans text-sm">{m.bodyText}</pre>
                        {m.status !== "SENT" && isIT && (
                          <ActionForm action={async () => { "use server"; return retryEmail(m.id); }} submitLabel="Retry sending" submitClass="btn-outline mt-2">
                            <span />
                          </ActionForm>
                        )}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {history.length > 0 && <Card title="Activity log"><HistoryList entries={history} /></Card>}
        </div>

        <div className="space-y-6">
          {isIT && open && (
            <>
              <Card title="Assign">
                <ActionForm action={assignRequest.bind(null, r.id)} submitLabel={r.assignedToId ? "Reassign" : "Take it"} submitClass="btn-teal">
                  <select name="assigneeId" className="input" defaultValue={r.assignedToId ?? user.id}>
                    {itUsers.map((u) => <option key={u.id} value={u.id}>{u.name}{u.id === user.id ? " (me)" : ""}</option>)}
                  </select>
                </ActionForm>
              </Card>
              <Card title="Close request">
                <ActionForm action={closeRequest.bind(null, r.id)} submitLabel="Close and email HR" confirm="Close this request and email HR the confirmation?">
                  <select name="outcome" className="input" defaultValue="COMPLETED">
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled / rejected</option>
                  </select>
                  <textarea name="note" rows={5} className="input" placeholder={"Summary for HR, e.g.\nAccounts: Email – j.smith, Windows – jsmith\nAssets: SIDC-LT-0012 (Dell Latitude, SN 4X…)"} />
                  <p className="text-xs text-slate-500">HR receives this as a formal email, stored in the record. Use the employee and asset pages to record the actual accounts and equipment.</p>
                </ActionForm>
              </Card>
              {r.type === "JOINER" && !r.employeeId && (
                <Card title="Next step">
                  <p className="mb-2 text-sm text-slate-600">Create the employee record, then assign assets from their page.</p>
                  <Link className="btn-outline w-full" href="/employees/new">+ Add employee</Link>
                </Card>
              )}
            </>
          )}
          {!isIT && r.status === "SUBMITTED" && r.raisedById === user.id && (
            <Card title="Withdraw request">
              <ActionForm action={withdrawRequest.bind(null, r.id)} submitLabel="Withdraw and notify IT" submitClass="btn-outline" confirm="Withdraw this request?">
                <input name="reason" className="input" placeholder="Reason" />
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
