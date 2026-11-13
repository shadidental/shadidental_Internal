"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AccountStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit, diff } from "@/lib/audit";
import { firstError, formObject, optDate, optEmail, optText, reqText } from "@/lib/validation";
import { ACCOUNT_STATUS_LABELS } from "@/lib/labels";
import { todayDate } from "@/lib/format";
import type { FormState } from "@/components/FormMessage";

const employeeSchema = z.object({
  employeeId: reqText("Employee ID", 50),
  fullName: reqText("Full name"),
  email: optEmail,
  jobTitle: optText(),
  department: optText(),
  branchId: optText(),
  lineManager: optText(),
  startDate: optDate,
  endDate: optDate,
}).refine((d) => !d.startDate || !d.endDate || d.endDate >= d.startDate, { message: "End date can't be before start date" });

function dupError(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" ? "Another employee already has that Employee ID." : null;
}

export async function createEmployee(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("employees:edit");
  const parsed = employeeSchema.safeParse(formObject(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  let id = "";
  try {
    id = await db.$transaction(async (tx) => {
      const emp = await tx.employee.create({ data: parsed.data });
      await audit({ actor: user, action: "CREATE", entityType: "Employee", entityId: emp.id, summary: `Added employee ${emp.fullName} (${emp.employeeId})`, after: emp }, tx);
      return emp.id;
    });
  } catch (e) {
    return { error: dupError(e) ?? "Could not save the employee." };
  }
  revalidatePath("/employees");
  redirect(`/employees/${id}`);
}

export async function updateEmployee(id: string, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("employees:edit");
  const parsed = employeeSchema.safeParse(formObject(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    await db.$transaction(async (tx) => {
      const before = await tx.employee.findUniqueOrThrow({ where: { id } });
      const d = diff(before as unknown as Record<string, unknown>, parsed.data);
      if (!d.changed.length) return;
      await tx.employee.update({ where: { id }, data: parsed.data });
      await audit({ actor: user, action: "UPDATE", entityType: "Employee", entityId: id, summary: `Edited ${before.fullName}: ${d.changed.join(", ")}`, before: d.before, after: d.after }, tx);
    });
  } catch (e) {
    return { error: dupError(e) ?? "Could not save the employee." };
  }
  revalidatePath(`/employees/${id}`);
  redirect(`/employees/${id}`);
}

export async function setEmployeeStatus(id: string, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("employees:edit");
  const status = form.get("status") === "LEFT" ? "LEFT" : "ACTIVE";
  const emp = await db.employee.findUniqueOrThrow({ where: { id }, include: { _count: { select: { assetsHeld: true } } } });
  if (status === "LEFT" && emp._count.assetsHeld > 0) {
    return { error: `${emp.fullName} still holds ${emp._count.assetsHeld} asset(s). Collect them first.` };
  }
  const endDate = status === "LEFT" ? emp.endDate ?? todayDate() : null;
  await db.$transaction(async (tx) => {
    await tx.employee.update({ where: { id }, data: { status, endDate } });
    await audit({ actor: user, action: "STATUS", entityType: "Employee", entityId: id, summary: `${emp.fullName} marked ${status === "LEFT" ? "Left" : "Active"}`, before: { status: emp.status, endDate: emp.endDate }, after: { status, endDate } }, tx);
  });
  revalidatePath(`/employees/${id}`);
  return { ok: "Status updated." };
}

export async function addAccount(employeeId: string, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("employees:edit");
  const parsed = z.object({
    system: reqText("System", 100),
    username: reqText("Username", 200),
    createdOn: optDate,
    notes: optText(500),
  }).safeParse(formObject(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (/password|pwd|passcode/i.test(parsed.data.notes ?? "")) {
    return { error: "Don't record passwords in the portal. Remove it from the notes." };
  }
  const emp = await db.employee.findUniqueOrThrow({ where: { id: employeeId } });
  await db.$transaction(async (tx) => {
    const acc = await tx.employeeAccount.create({
      data: { employeeId, system: parsed.data.system, username: parsed.data.username, createdOn: parsed.data.createdOn ?? todayDate(), notes: parsed.data.notes, createdById: user.id },
    });
    await audit({ actor: user, action: "CREATE", entityType: "Employee", entityId: employeeId, summary: `Recorded ${acc.system} account “${acc.username}” for ${emp.fullName}`, after: { system: acc.system, username: acc.username } }, tx);
  });
  revalidatePath(`/employees/${employeeId}`);
  return { ok: "Account recorded." };
}

export async function setAccountStatus(accountId: string, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("employees:edit");
  const status = String(form.get("status")) as AccountStatus;
  if (!(status in ACCOUNT_STATUS_LABELS)) return { error: "Choose a status." };
  const acc = await db.employeeAccount.findUniqueOrThrow({ where: { id: accountId }, include: { employee: true } });
  if (acc.status === status) return { error: "Already set." };
  const today = todayDate();
  const data = {
    status,
    disabledOn: status === "DISABLED" ? today : status === "ACTIVE" ? null : acc.disabledOn ?? today,
    deletedOn: status === "DELETED" ? today : null,
  };
  await db.$transaction(async (tx) => {
    await tx.employeeAccount.update({ where: { id: accountId }, data });
    await audit({ actor: user, action: "UPDATE", entityType: "Employee", entityId: acc.employeeId, summary: `${acc.system} account “${acc.username}” for ${acc.employee.fullName}: ${ACCOUNT_STATUS_LABELS[acc.status]} → ${ACCOUNT_STATUS_LABELS[status]}`, before: { status: acc.status }, after: { status } }, tx);
  });
  revalidatePath(`/employees/${acc.employeeId}`);
  return { ok: "Updated." };
}

export async function deleteEmployee(id: string): Promise<FormState> {
  const user = await requireUser("employees:delete");
  const emp = await db.employee.findUniqueOrThrow({ where: { id }, include: { _count: { select: { assignments: true, accounts: true, requests: true } } } });
  if (emp._count.assignments || emp._count.accounts || emp._count.requests) {
    return { error: "This employee has asset, account or request history, so the record must be kept. Mark them as Left instead." };
  }
  await db.$transaction(async (tx) => {
    await tx.employee.delete({ where: { id } });
    await audit({ actor: user, action: "DELETE", entityType: "Employee", entityId: id, summary: `Deleted employee ${emp.fullName} (${emp.employeeId})`, before: emp }, tx);
  });
  revalidatePath("/employees");
  redirect("/employees");
}
