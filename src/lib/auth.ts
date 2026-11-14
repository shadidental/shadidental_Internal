import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { PortalUser, Role } from "@prisma/client";
import { db } from "./db";
import { config } from "./config";
import { randomToken, sha256 } from "./crypto";
import { can, type Permission } from "./permissions";

export const SESSION_COOKIE = "sidc_session";

export type CurrentUser = Pick<PortalUser, "id" | "email" | "name" | "role" | "totpEnabled">;

/**
 * One session lookup per request: layout, page and actions all share it
 * (React cache), and the user is fetched in the same query via a JOIN.
 */
const readSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  // findFirst (not findUnique): Prisma batches findUnique calls and then
  // fetches the user in a second round trip; findFirst keeps the JOIN.
  const session = await db.session.findFirst({
    relationLoadStrategy: "join",
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  // Touch at most every 5 minutes, without making the page wait for it.
  if (Date.now() - session.lastSeenAt.getTime() > 300_000) {
    db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return session;
});

/** Creates a half-authenticated session after the emailed code is verified. */
export async function createSession(userId: string) {
  const token = randomToken();
  const h = await headers();
  const expiresAt = new Date(Date.now() + config.sessionHours * 3600_000);
  await db.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      expiresAt,
      mfaPassed: !config.mfaRequired,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Session that passed the email code but maybe not MFA yet. */
export async function getPendingSession() {
  return readSession();
}

/** Fully signed-in user, or null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const s = await readSession();
  if (!s || !s.mfaPassed) return null;
  const { id, email, name, role, totpEnabled } = s.user;
  return { id, email, name, role, totpEnabled };
}

/** Use in pages and server actions. Redirects to sign-in, or 403s. */
export async function requireUser(permission?: Permission): Promise<CurrentUser> {
  const s = await readSession();
  if (!s) redirect("/login");
  if (!s.mfaPassed) redirect(s.user.totpEnabled ? "/login/mfa" : "/login/mfa/setup");
  const { id, email, name, role, totpEnabled } = s.user;
  if (permission && !can(role, permission)) redirect("/forbidden");
  return { id, email, name, role, totpEnabled };
}

export function hasRole(user: { role: Role }, ...roles: Role[]) {
  return roles.includes(user.role);
}
