import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { db } from "./db";
import { config } from "./config";

export type OutgoingEmail = {
  kind: string;
  to: string[];
  cc?: string[];
  subject: string;
  text: string;
  html: string;
  requestId?: string | null;
  sentById?: string | null;
  /** Sign-in codes etc. are sent but not kept in the official email record. */
  record?: boolean;
};

function transportName(): string {
  return process.env.EMAIL_TRANSPORT || (process.env.SMTP_HOST ? "smtp" : "log");
}

let smtp: Transporter | null = null;
function smtpTransport() {
  if (!smtp) {
    const port = Number(process.env.SMTP_PORT || 587);
    smtp = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
      requireTLS: port === 587,
    });
  }
  return smtp;
}

async function deliver(email: OutgoingEmail): Promise<{ messageId?: string }> {
  const name = transportName();
  if (name === "log") {
    console.log(
      `\n──── EMAIL (EMAIL_TRANSPORT=log, not actually sent) ────\nTo: ${email.to.join(", ")}\nCc: ${(email.cc ?? []).join(", ")}\nSubject: ${email.subject}\n\n${email.text}\n────────────────────────────────────────────────\n`,
    );
    return { messageId: `log-${Date.now()}` };
  }
  const info = await smtpTransport().sendMail({
    from: `"${config.orgShort} IT Portal" <${config.mailFrom}>`,
    to: email.to,
    cc: email.cc,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
  return { messageId: info.messageId };
}

/**
 * Stores the email in the official record FIRST, then sends it and records the
 * delivery result. The stored copy is append-only (DB trigger), so it is the
 * auditable evidence of what was sent, to whom and when.
 */
export async function sendEmail(email: OutgoingEmail): Promise<{ ok: boolean; error?: string; id?: string }> {
  const to = unique(email.to);
  const cc = unique(email.cc ?? []).filter((a) => !to.includes(a));
  if (email.record === false) {
    try {
      await deliver({ ...email, to, cc });
      return { ok: true };
    } catch (e) {
      console.error("Email send failed", e);
      return { ok: false, error: String((e as Error).message || e) };
    }
  }
  const row = await db.emailLog.create({
    data: {
      kind: email.kind,
      requestId: email.requestId ?? null,
      sentById: email.sentById ?? null,
      fromAddress: config.mailFrom,
      toAddresses: to,
      ccAddresses: cc,
      subject: email.subject,
      bodyText: email.text,
      bodyHtml: email.html,
      transport: transportName(),
    },
  });
  try {
    const { messageId } = await deliver({ ...email, to, cc });
    await db.emailLog.update({
      where: { id: row.id },
      data: { status: "SENT", sentAt: new Date(), messageId: messageId ?? null },
    });
    return { ok: true, id: row.id };
  } catch (e) {
    const error = String((e as Error).message || e).slice(0, 1000);
    await db.emailLog.update({ where: { id: row.id }, data: { status: "FAILED", error } });
    return { ok: false, error, id: row.id };
  }
}

/** Retry a failed email from its stored copy (content cannot change). */
export async function resendEmail(id: string) {
  const row = await db.emailLog.findUniqueOrThrow({ where: { id } });
  try {
    const { messageId } = await deliver({
      kind: row.kind, to: row.toAddresses, cc: row.ccAddresses,
      subject: row.subject, text: row.bodyText, html: row.bodyHtml,
    });
    await db.emailLog.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), messageId: messageId ?? null, error: null } });
    return { ok: true };
  } catch (e) {
    const error = String((e as Error).message || e).slice(0, 1000);
    await db.emailLog.update({ where: { id }, data: { status: "FAILED", error } });
    return { ok: false, error };
  }
}

function unique(list: string[]) {
  return [...new Set(list.map((a) => a.trim().toLowerCase()).filter(Boolean))];
}
