"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { HrRequestType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { config } from "@/lib/config";
import { sendEmail, resendEmail as resend } from "@/lib/email";
import { requestClosedEmail, requestSubmittedEmail } from "@/lib/email-templates";
import { nextRequestRef } from "@/lib/sequences";
import { firstError, formObject, optDate, optText } from "@/lib/validation";
import { REQUEST_STATUS_LABELS } from "@/lib/labels";
import type { FormState } from "@/components/FormMessage";

const requestSchema = z.object({
  type: z.enum(HrRequestType, { error: "Choose a request type" }),
  employeeRef: optText(), // existing employee (id) – leaver / allocation / return
  employeeName: optText(),
  employeeNumber: optText(50),
  jobTitle: optText(),
  department: optText(),
  branchName: optText(),
  lineManager: optText(),
  effectiveDate: optDate,
  details: optText(4000),
});

async function hrRecipients(raisedByEmail: string) {
  return [raisedByEmail, ...(config.hrMailbox ? [config.hrMailbox] : [])];
}

export async function createRequest(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("requests:create");
  const parsed = requestSchema.safeParse(formObject(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;

  let employee = null;
  if (d.type !== "JOINER") {
    if (!d.employeeRef) return { error: "Choose the employee this request is about." };
    employee = await db.employee.findUnique({ where: { id: d.employeeRef }, include: { branch: true } });
    if (!employee) return { error: "Employee not found." };
  } else {
    if (!d.employeeName) return { error: "Enter the new joiner's full name." };
    if (!d.effectiveDate) return { error: "Enter the start date." };
    if (d.employeeNumber) {
      const exists = await db.employee.findUnique({ where: { employeeId: d.employeeNumber } });
      if (exists) return { error: `Employee ID ${d.employeeNumber} already belongs to ${exists.fullName}.` };
    }
  }
  if (d.type === "LEAVER" && !d.effectiveDate) return { error: "Enter the last working day." };

  const req = await db.$transaction(async (tx) => {
    const reference = await nextRequestRef(tx);
    const r = await tx.hrRequest.create({
      data: {
        reference,
        type: d.type,
        employeeId: employee?.id ?? null,
        employeeName: employee?.fullName ?? d.employeeName!,
        employeeNumber: employee?.employeeId ?? d.employeeNumber,
        jobTitle: employee?.jobTitle ?? d.jobTitle,
        department: employee?.department ?? d.department,
        branchName: employee?.branch?.name ?? d.branchName,
        lineManager: employee?.lineManager ?? d.lineManager,
        effectiveDate: d.effectiveDate,
        details: d.details,
        raisedById: user.id,
      },
    });
    await audit({ actor: user, action: "CREATE", entityType: "HrRequest", entityId: r.id, summary: `${user.name} raised ${reference}: ${r.type} for ${r.employeeName}`, after: r }, tx);
    return r;
  });

  // The formal HR → IT email. Stored in full before sending (official record).
  const msg = requestSubmittedEmail(req, user);
  const sent = await sendEmail({
    kind: "REQUEST_SUBMITTED", requestId: req.id, sentById: user.id,
    to: [config.itMailbox], cc: await hrRecipients(user.email), ...msg,
  });
  await audit({
    actor: user, action: "SEND", entityType: "HrRequest", entityId: req.id,
    summary: sent.ok ? `Request email sent to IT (${config.itMailbox})` : `Request email to IT FAILED: ${sent.error}`,
  });
  revalidatePath("/requests");
  redirect(`/requests/${req.reference}${sent.ok ? "?sent=1" : "?sent=0"}`);
}

export async function addComment(requestId: string, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("requests:comment");
  const body = String(form.get("body") || "").trim();
  if (!body) return { error: "Write a comment first." };
  if (body.length > 4000) return { error: "Comment is too long." };
  const r = await db.hrRequest.findUniqueOrThrow({ where: { id: requestId } });
  await db.$transaction(async (tx) => {
    await tx.hrRequestComment.create({ data: { requestId, authorId: user.id, body } });
    await audit({ actor: user, action: "COMMENT", entityType: "HrRequest", entityId: requestId, summary: `${user.name} commented on ${r.reference}`, after: { body } }, tx);
  });
  revalidatePath(`/requests/${r.reference}`);
  return { ok: "Comment added." };
}

export async function assignRequest(requestId: string, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("requests:work");
  const assigneeId = String(form.get("assigneeId") || user.id);
  const r = await db.hrRequest.findUniqueOrThrow({ where: { id: requestId }, include: { assignedTo: true } });
  if (r.status === "COMPLETED" || r.status === "CANCELLED") return { error: "This request is closed." };
  const assignee = await db.portalUser.findUniqueOrThrow({ where: { id: assigneeId } });
  if (!can(assignee.role, "requests:work") || !assignee.active) return { error: "Choose an active IT user." };
  await db.$transaction(async (tx) => {
    await tx.hrRequest.update({ where: { id: requestId }, data: { assignedToId: assignee.id, status: "IN_PROGRESS" } });
    await audit({
      actor: user, action: "ASSIGN", entityType: "HrRequest", entityId: requestId,
      summary: `${r.reference} assigned to ${assignee.name}`,
      before: { status: r.status, assignedTo: r.assignedTo?.name ?? null }, after: { status: "IN_PROGRESS", assignedTo: assignee.name },
    }, tx);
  });
  revalidatePath(`/requests/${r.reference}`);
  return { ok: `Assigned to ${assignee.name}.` };
}

/** IT closes the request; HR gets a formal confirmation email (stored). */
export async function closeRequest(requestId: string, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("requests:work");
  const outcome = form.get("outcome") === "CANCELLED" ? "CANCELLED" : "COMPLETED";
  const note = String(form.get("note") || "").trim();
  if (!note) return { error: outcome === "COMPLETED" ? "Summarise what was done (accounts created, assets assigned…)." : "Give a reason." };
  const r = await db.hrRequest.findUniqueOrThrow({ where: { id: requestId }, include: { raisedBy: true } });
  if (r.status === "COMPLETED" || r.status === "CANCELLED") return { error: "This request is already closed." };
  await db.$transaction(async (tx) => {
    await tx.hrRequest.update({ where: { id: requestId }, data: { status: outcome, completedAt: new Date(), assignedToId: r.assignedToId ?? user.id } });
    await tx.hrRequestComment.create({ data: { requestId, authorId: user.id, body: `${outcome === "COMPLETED" ? "Completed" : "Cancelled"}: ${note}` } });
    await audit({ actor: user, action: outcome === "COMPLETED" ? "COMPLETE" : "CANCEL", entityType: "HrRequest", entityId: requestId, summary: `${r.reference} ${REQUEST_STATUS_LABELS[outcome].toLowerCase()} by ${user.name}`, before: { status: r.status }, after: { status: outcome, note } }, tx);
  });
  const msg = requestClosedEmail(r, outcome, user, note);
  const sent = await sendEmail({
    kind: `REQUEST_${outcome}`, requestId, sentById: user.id,
    to: await hrRecipients(r.raisedBy.email), cc: [config.itMailbox], ...msg,
  });
  await audit({ actor: user, action: "SEND", entityType: "HrRequest", entityId: requestId, summary: sent.ok ? `Confirmation email sent to HR (${r.raisedBy.email})` : `Confirmation email to HR FAILED: ${sent.error}` });
  revalidatePath(`/requests/${r.reference}`);
  redirect(`/requests/${r.reference}?closed=${sent.ok ? "1" : "0"}`);
}

/** HR may withdraw their own request while IT hasn't started it. */
export async function withdrawRequest(requestId: string, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("requests:create");
  const reason = String(form.get("reason") || "").trim();
  if (!reason) return { error: "Give a reason." };
  const r = await db.hrRequest.findUniqueOrThrow({ where: { id: requestId } });
  if (r.raisedById !== user.id && !can(user.role, "requests:work")) return { error: "Only the person who raised it can withdraw it." };
  if (r.status !== "SUBMITTED") return { error: "IT has already started this request. Add a comment instead." };
  await db.$transaction(async (tx) => {
    await tx.hrRequest.update({ where: { id: requestId }, data: { status: "CANCELLED", completedAt: new Date() } });
    await tx.hrRequestComment.create({ data: { requestId, authorId: user.id, body: `Withdrawn by HR: ${reason}` } });
    await audit({ actor: user, action: "CANCEL", entityType: "HrRequest", entityId: requestId, summary: `${r.reference} withdrawn by ${user.name}`, before: { status: r.status }, after: { status: "CANCELLED", reason } }, tx);
  });
  const subject = `[${r.reference}] Request withdrawn by HR – ${r.employeeName}`;
  const text = `Dear IT Team,\n\nHR has withdrawn request ${r.reference} (${r.employeeName}).\n\nReason: ${reason}\n\nWithdrawn by: ${user.name} (${user.email})\n\nSent from the ${config.orgName} IT Portal.`;
  const sent = await sendEmail({ kind: "REQUEST_WITHDRAWN", requestId, sentById: user.id, to: [config.itMailbox], cc: await hrRecipients(user.email), subject, text, html: `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</pre>` });
  await audit({ actor: user, action: "SEND", entityType: "HrRequest", entityId: requestId, summary: sent.ok ? "Withdrawal email sent to IT" : `Withdrawal email FAILED: ${sent.error}` });
  revalidatePath(`/requests/${r.reference}`);
  redirect(`/requests/${r.reference}?withdrawn=1`);
}

export async function retryEmail(emailId: string): Promise<FormState> {
  const user = await requireUser("requests:work");
  const row = await db.emailLog.findUniqueOrThrow({ where: { id: emailId }, include: { request: true } });
  if (row.status === "SENT") return { error: "Already sent." };
  const res = await resend(emailId);
  await audit({ actor: user, action: "SEND", entityType: "HrRequest", entityId: row.requestId, summary: res.ok ? `Retried email “${row.subject}”: sent` : `Retried email “${row.subject}”: FAILED ${res.error}` });
  if (row.request) revalidatePath(`/requests/${row.request.reference}`);
  return res.ok ? { ok: "Sent." } : { error: res.error };
}
