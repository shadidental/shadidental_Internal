"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/email-templates";
import { ROLE_LABELS } from "@/lib/permissions";
import { firstError, formObject, reqText } from "@/lib/validation";
import type { FormState } from "@/components/FormMessage";

const userSchema = z.object({
  email: z.preprocess((v) => String(v ?? "").trim().toLowerCase(), z.email("Enter a valid email")),
  name: reqText("Name"),
  role: z.enum(Role, { error: "Choose a role" }),
});

async function otherActiveAdmins(excludeId: string) {
  return db.portalUser.count({ where: { role: "ADMIN", active: true, id: { not: excludeId } } });
}

export async function addUser(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireUser("users:manage");
  const parsed = userSchema.safeParse(formObject(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const existing = await db.portalUser.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { error: existing.active ? "That email already has access." : "That user exists but is deactivated. Re-activate them in the list below." };
  const u = await db.$transaction(async (tx) => {
    const u = await tx.portalUser.create({ data: { ...parsed.data, createdById: admin.id } });
    await audit({ actor: admin, action: "CREATE", entityType: "PortalUser", entityId: u.id, summary: `Gave ${u.email} ${ROLE_LABELS[u.role]} access`, after: { email: u.email, name: u.name, role: u.role } }, tx);
    return u;
  });
  if (form.get("notify") === "on") {
    await sendEmail({ kind: "WELCOME", to: [u.email], sentById: admin.id, ...welcomeEmail(u, ROLE_LABELS[u.role]) });
  }
  revalidatePath("/admin/users");
  return { ok: `${u.name} can now sign in.` };
}

export async function updateUser(id: string, _: FormState, form: FormData): Promise<FormState> {
  const admin = await requireUser("users:manage");
  const role = String(form.get("role")) as Role;
  const name = String(form.get("name") || "").trim();
  if (!(role in ROLE_LABELS)) return { error: "Choose a role." };
  if (!name) return { error: "Name is required." };
  const u = await db.portalUser.findUniqueOrThrow({ where: { id } });
  if (u.role === "ADMIN" && role !== "ADMIN" && (await otherActiveAdmins(id)) === 0) {
    return { error: "There must always be at least one active IT Admin." };
  }
  if (u.role === role && u.name === name) return { error: "Nothing changed." };
  await db.$transaction(async (tx) => {
    await tx.portalUser.update({ where: { id }, data: { role, name } });
    // Role changes take effect immediately: end their sessions.
    if (u.role !== role) await tx.session.deleteMany({ where: { userId: id } });
    await audit({ actor: admin, action: "UPDATE", entityType: "PortalUser", entityId: id, summary: `Changed ${u.email}: ${u.role !== role ? `${ROLE_LABELS[u.role]} → ${ROLE_LABELS[role]}` : "name"}`, before: { role: u.role, name: u.name }, after: { role, name } }, tx);
  });
  revalidatePath("/admin/users");
  return { ok: "Saved." };
}

export async function setUserActive(id: string, active: boolean): Promise<FormState> {
  const admin = await requireUser("users:manage");
  const u = await db.portalUser.findUniqueOrThrow({ where: { id } });
  if (!active && id === admin.id) return { error: "You can't remove your own access." };
  if (!active && u.role === "ADMIN" && (await otherActiveAdmins(id)) === 0) return { error: "There must always be at least one active IT Admin." };
  await db.$transaction(async (tx) => {
    await tx.portalUser.update({ where: { id }, data: { active } });
    if (!active) await tx.session.deleteMany({ where: { userId: id } });
    await audit({ actor: admin, action: active ? "ENABLE" : "DISABLE", entityType: "PortalUser", entityId: id, summary: `${active ? "Restored" : "Removed"} portal access for ${u.email}`, before: { active: u.active }, after: { active } }, tx);
  });
  revalidatePath("/admin/users");
  return { ok: active ? "Access restored." : "Access removed and signed out." };
}

export async function resetMfa(id: string): Promise<FormState> {
  const admin = await requireUser("users:manage");
  const u = await db.portalUser.findUniqueOrThrow({ where: { id } });
  await db.$transaction(async (tx) => {
    await tx.portalUser.update({ where: { id }, data: { totpEnabled: false, totpSecret: null } });
    await tx.session.deleteMany({ where: { userId: id } });
    await audit({ actor: admin, action: "MFA_RESET", entityType: "PortalUser", entityId: id, summary: `Reset two-step verification for ${u.email}` }, tx);
  });
  revalidatePath("/admin/users");
  return { ok: "Two-step verification reset. They'll set it up again at next sign-in." };
}
