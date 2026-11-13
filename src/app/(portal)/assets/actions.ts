"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AssetCategory, AssetStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit, diff } from "@/lib/audit";
import { nextAssetTag } from "@/lib/sequences";
import { firstError, formObject, optDate, optMoney, optText, reqDate } from "@/lib/validation";
import { ASSET_STATUS_LABELS } from "@/lib/labels";
import { fmtDate } from "@/lib/format";
import type { FormState } from "@/components/FormMessage";

const assetSchema = z.object({
  category: z.enum(AssetCategory, { error: "Choose a category" }),
  make: optText(),
  model: optText(),
  serialNumber: optText(),
  purchaseDate: optDate,
  vendor: optText(),
  purchaseCost: optMoney,
  invoiceRef: optText(),
  warrantyExpiry: optDate,
  branchId: optText(),
  conditionNotes: optText(2000),
});

function uniqueError(e: unknown): string | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    return "Another asset already has that serial number.";
  }
  return null;
}

export async function createAsset(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("assets:edit");
  const parsed = assetSchema.safeParse(formObject(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  let id = "";
  try {
    id = await db.$transaction(async (tx) => {
      const assetTag = await nextAssetTag(tx, parsed.data.category);
      const asset = await tx.asset.create({ data: { ...parsed.data, assetTag } });
      await audit({ actor: user, action: "CREATE", entityType: "Asset", entityId: asset.id, summary: `Added asset ${assetTag}`, after: asset }, tx);
      return asset.id;
    });
  } catch (e) {
    return { error: uniqueError(e) ?? "Could not save the asset." };
  }
  revalidatePath("/assets");
  redirect(`/assets/${id}`);
}

export async function updateAsset(id: string, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("assets:edit");
  const parsed = assetSchema.safeParse(formObject(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    await db.$transaction(async (tx) => {
      const before = await tx.asset.findUniqueOrThrow({ where: { id } });
      const d = diff(before as unknown as Record<string, unknown>, parsed.data);
      if (!d.changed.length) return;
      await tx.asset.update({ where: { id }, data: parsed.data });
      await audit({ actor: user, action: "UPDATE", entityType: "Asset", entityId: id, summary: `Edited ${before.assetTag}: ${d.changed.join(", ")}`, before: d.before, after: d.after }, tx);
    });
  } catch (e) {
    return { error: uniqueError(e) ?? "Could not save the asset." };
  }
  revalidatePath(`/assets/${id}`);
  redirect(`/assets/${id}`);
}

export async function assignAsset(id: string, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("assets:edit");
  const parsed = z.object({
    employeeId: z.string().min(1, "Choose an employee"),
    date: reqDate("Date"),
    condition: optText(500),
  }).safeParse(formObject(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { employeeId, date, condition } = parsed.data;
  try {
    await db.$transaction(async (tx) => {
      const asset = await tx.asset.findUniqueOrThrow({ where: { id } });
      if (asset.status !== "IN_STOCK") throw new Error("Only assets that are In stock can be assigned. Return it first.");
      const emp = await tx.employee.findUniqueOrThrow({ where: { id: employeeId } });
      if (emp.status !== "ACTIVE") throw new Error("That employee has left.");
      await tx.assetAssignment.create({ data: { assetId: id, employeeId, assignedAt: date, assignedById: user.id, conditionOut: condition } });
      await tx.asset.update({ where: { id }, data: { status: "ASSIGNED", currentOwnerId: employeeId, branchId: asset.branchId ?? emp.branchId } });
      await audit({
        actor: user, action: "ASSIGN", entityType: "Asset", entityId: id,
        summary: `Assigned ${asset.assetTag} to ${emp.fullName} (${emp.employeeId}) on ${fmtDate(date)}`,
        before: { status: asset.status, owner: null }, after: { status: "ASSIGNED", owner: `${emp.fullName} (${emp.employeeId})`, condition },
      }, tx);
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/assets/${id}`);
  return { ok: "Asset assigned." };
}

export async function returnAsset(id: string, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("assets:edit");
  const parsed = z.object({
    date: reqDate("Date"),
    condition: optText(500),
    newStatus: z.enum(["IN_STOCK", "UNDER_REPAIR", "LOST_STOLEN"]),
  }).safeParse(formObject(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { date, condition, newStatus } = parsed.data;
  try {
    await db.$transaction(async (tx) => {
      const asset = await tx.asset.findUniqueOrThrow({ where: { id }, include: { currentOwner: true } });
      if (asset.status !== "ASSIGNED") throw new Error("This asset is not assigned to anyone.");
      const open = await tx.assetAssignment.findFirst({ where: { assetId: id, returnedAt: null }, orderBy: { assignedAt: "desc" } });
      if (open) {
        if (date < open.assignedAt) throw new Error("Return date can't be before the assignment date.");
        await tx.assetAssignment.update({ where: { id: open.id }, data: { returnedAt: date, returnedById: user.id, conditionIn: condition } });
      }
      await tx.asset.update({ where: { id }, data: { status: newStatus, currentOwnerId: null, conditionNotes: condition ?? asset.conditionNotes } });
      const who = asset.currentOwner ? `${asset.currentOwner.fullName} (${asset.currentOwner.employeeId})` : "employee";
      await audit({
        actor: user, action: "RETURN", entityType: "Asset", entityId: id,
        summary: `Collected ${asset.assetTag} from ${who} on ${fmtDate(date)} → ${ASSET_STATUS_LABELS[newStatus]}`,
        before: { status: asset.status, owner: who }, after: { status: newStatus, owner: null, condition },
      }, tx);
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/assets/${id}`);
  return { ok: "Asset returned." };
}

export async function transferAsset(id: string, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("assets:edit");
  const branchId = String(form.get("branchId") || "");
  const note = String(form.get("note") || "").trim() || null;
  if (!branchId) return { error: "Choose a branch." };
  const asset = await db.asset.findUniqueOrThrow({ where: { id }, include: { branch: true } });
  const to = await db.branch.findUniqueOrThrow({ where: { id: branchId } });
  if (asset.branchId === branchId) return { error: "The asset is already at that branch." };
  await db.$transaction(async (tx) => {
    await tx.asset.update({ where: { id }, data: { branchId } });
    await audit({
      actor: user, action: "TRANSFER", entityType: "Asset", entityId: id,
      summary: `Moved ${asset.assetTag} from ${asset.branch?.name ?? "no branch"} to ${to.name}${note ? ` (${note})` : ""}`,
      before: { branch: asset.branch?.name ?? null }, after: { branch: to.name, note },
    }, tx);
  });
  revalidatePath(`/assets/${id}`);
  return { ok: `Moved to ${to.name}.` };
}

export async function setAssetStatus(id: string, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("assets:edit");
  const status = String(form.get("status") || "") as AssetStatus;
  const note = String(form.get("note") || "").trim() || null;
  if (!["IN_STOCK", "UNDER_REPAIR", "RETIRED", "LOST_STOLEN"].includes(status)) return { error: "Choose a status." };
  const asset = await db.asset.findUniqueOrThrow({ where: { id } });
  if (asset.status === "ASSIGNED") return { error: "Return the asset from its owner first." };
  if (asset.status === status) return { error: "The asset already has that status." };
  await db.$transaction(async (tx) => {
    await tx.asset.update({ where: { id }, data: { status } });
    await audit({
      actor: user, action: status === "RETIRED" ? "RETIRE" : "STATUS", entityType: "Asset", entityId: id,
      summary: `${asset.assetTag}: ${ASSET_STATUS_LABELS[asset.status]} → ${ASSET_STATUS_LABELS[status]}${note ? ` (${note})` : ""}`,
      before: { status: asset.status }, after: { status, note },
    }, tx);
  });
  revalidatePath(`/assets/${id}`);
  return { ok: `Status set to ${ASSET_STATUS_LABELS[status]}.` };
}

export async function deleteAsset(id: string): Promise<FormState> {
  const user = await requireUser("assets:delete");
  const asset = await db.asset.findUniqueOrThrow({ where: { id }, include: { _count: { select: { assignments: true } } } });
  if (asset._count.assignments > 0) {
    return { error: "This asset has an owner history, so it can't be deleted. Retire it instead." };
  }
  await db.$transaction(async (tx) => {
    await tx.asset.delete({ where: { id } });
    await audit({ actor: user, action: "DELETE", entityType: "Asset", entityId: id, summary: `Deleted asset ${asset.assetTag}`, before: asset }, tx);
  });
  revalidatePath("/assets");
  redirect("/assets");
}
