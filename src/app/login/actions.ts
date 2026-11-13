"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { createSession, getPendingSession } from "@/lib/auth";
import { decrypt, encrypt, generateTotpSecret, hmac, randomDigits, safeEqual, verifyTotp } from "@/lib/crypto";
import { sendEmail } from "@/lib/email";
import { signInCodeEmail } from "@/lib/email-templates";
import type { FormState } from "@/components/FormMessage";

const LOGIN_EMAIL_COOKIE = "sidc_login_email";
const CODE_TTL_MS = 10 * 60_000;
const MAX_CODES_PER_WINDOW = 5;
const MAX_CODE_ATTEMPTS = 5;
const MAX_MFA_ATTEMPTS = 5;

export async function requestCode(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address." };

  const recent = await db.loginCode.count({
    where: { email, createdAt: { gt: new Date(Date.now() - 15 * 60_000) } },
  });
  if (recent >= MAX_CODES_PER_WINDOW) return { error: "Too many codes requested. Wait 15 minutes and try again." };

  const user = await db.portalUser.findUnique({ where: { email } });
  // Same response whether or not the email is a portal user (no account probing).
  if (user?.active) {
    const code = randomDigits(6);
    await db.loginCode.create({ data: { email, codeHash: hmac(code), expiresAt: new Date(Date.now() + CODE_TTL_MS) } });
    const msg = signInCodeEmail(code);
    const sent = await sendEmail({ kind: "SIGN_IN_CODE", to: [email], ...msg, record: false });
    if (!sent.ok) return { error: "The sign-in email could not be sent. Please contact the IT team." };
  } else {
    await db.loginCode.create({ data: { email, codeHash: "unknown-user", expiresAt: new Date() } });
  }
  (await cookies()).set(LOGIN_EMAIL_COOKIE, encrypt(email), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 15 * 60, path: "/login",
  });
  redirect("/login?step=code");
}

export async function verifyCode(_: FormState, form: FormData): Promise<FormState> {
  const raw = (await cookies()).get(LOGIN_EMAIL_COOKIE)?.value;
  let email = "";
  try { email = raw ? decrypt(raw) : ""; } catch { email = ""; }
  if (!email) redirect("/login");
  const code = String(form.get("code") || "").replace(/\s/g, "");

  const row = await db.loginCode.findFirst({
    where: { email, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!row || row.attempts >= MAX_CODE_ATTEMPTS) return { error: "That code has expired. Request a new one." };
  if (!safeEqual(row.codeHash, hmac(code))) {
    await db.loginCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return { error: "That code is not correct." };
  }
  const user = await db.portalUser.findUnique({ where: { email } });
  if (!user?.active) return { error: "That code has expired. Request a new one." };

  await db.loginCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  (await cookies()).delete({ name: LOGIN_EMAIL_COOKIE, path: "/login" });
  await createSession(user.id);
  const pending = await getPendingSession();
  if (pending?.mfaPassed) {
    await markLoggedIn(user.id, user.email);
    redirect("/");
  }
  redirect(user.totpEnabled ? "/login/mfa" : "/login/mfa/setup");
}

export async function verifyMfa(_: FormState, form: FormData): Promise<FormState> {
  const s = await getPendingSession();
  if (!s) redirect("/login");
  if (!s.user.totpEnabled || !s.user.totpSecret) redirect("/login/mfa/setup");
  if (s.mfaAttempts >= MAX_MFA_ATTEMPTS) {
    await db.session.delete({ where: { id: s.id } });
    return { error: "Too many attempts. Start again from the sign-in page." };
  }
  const ok = verifyTotp(decrypt(s.user.totpSecret), String(form.get("code") || ""));
  if (!ok) {
    await db.session.update({ where: { id: s.id }, data: { mfaAttempts: { increment: 1 } } });
    return { error: "That code is not correct. Use the current code from your authenticator app." };
  }
  await db.session.update({ where: { id: s.id }, data: { mfaPassed: true } });
  await markLoggedIn(s.user.id, s.user.email);
  redirect("/");
}

/** Creates (once) the secret shown as a QR code during first-time setup. */
export async function ensureSetupSecret(): Promise<{ secret: string; email: string } | null> {
  const s = await getPendingSession();
  if (!s || s.user.totpEnabled) return null;
  if (s.user.totpSecret) return { secret: decrypt(s.user.totpSecret), email: s.user.email };
  const secret = generateTotpSecret();
  await db.portalUser.update({ where: { id: s.user.id }, data: { totpSecret: encrypt(secret) } });
  return { secret, email: s.user.email };
}

export async function confirmMfaSetup(_: FormState, form: FormData): Promise<FormState> {
  const s = await getPendingSession();
  if (!s) redirect("/login");
  if (s.user.totpEnabled) redirect("/login/mfa");
  if (!s.user.totpSecret) return { error: "Reload the page and try again." };
  if (!verifyTotp(decrypt(s.user.totpSecret), String(form.get("code") || ""))) {
    return { error: "That code is not correct. Check the time on your phone is set automatically." };
  }
  await db.$transaction([
    db.portalUser.update({ where: { id: s.user.id }, data: { totpEnabled: true } }),
    db.session.update({ where: { id: s.id }, data: { mfaPassed: true } }),
  ]);
  await audit({ actor: s.user, action: "MFA_ENROLLED", entityType: "PortalUser", entityId: s.user.id, summary: `${s.user.email} set up an authenticator app` });
  await markLoggedIn(s.user.id, s.user.email);
  redirect("/");
}

async function markLoggedIn(id: string, email: string) {
  await db.portalUser.update({ where: { id }, data: { lastLoginAt: new Date() } });
  await audit({ actor: { id, email }, action: "LOGIN", entityType: "PortalUser", entityId: id, summary: `${email} signed in` });
}
