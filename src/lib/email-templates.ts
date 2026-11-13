import type { HrRequest, HrRequestType } from "@prisma/client";
import { config } from "./config";
import { escapeHtml, fmtDate, fmtDateTime } from "./format";
import { REQUEST_TYPE_DATE_LABEL, REQUEST_TYPE_LABELS } from "./labels";

type Req = Pick<
  HrRequest,
  | "reference" | "type" | "employeeName" | "employeeNumber" | "jobTitle" | "department"
  | "branchName" | "lineManager" | "effectiveDate" | "details" | "createdAt"
>;

function rows(req: Req): [string, string][] {
  return [
    ["Request type", REQUEST_TYPE_LABELS[req.type]],
    ["Employee name", req.employeeName],
    ["Employee ID", req.employeeNumber || "—"],
    ["Job title", req.jobTitle || "—"],
    ["Department", req.department || "—"],
    ["Branch", req.branchName || "—"],
    ["Line manager", req.lineManager || "—"],
    [REQUEST_TYPE_DATE_LABEL[req.type], fmtDate(req.effectiveDate)],
  ];
}

function layout(title: string, intro: string, table: [string, string][], extra: string, footer: string) {
  const tr = table
    .map(([k, v]) => `<tr><td style="padding:6px 12px;color:#64748b;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:6px 12px">${escapeHtml(v)}</td></tr>`)
    .join("");
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;margin:0;padding:24px;background:#f8fafc">
<div style="max-width:640px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
<div style="background:#6B2D62;color:#fff;padding:16px 20px;font-size:18px;font-weight:bold">${escapeHtml(title)}</div>
<div style="height:4px;background:#62B8AE"></div>
<div style="padding:20px">
<p>${intro}</p>
<table style="border-collapse:collapse;width:100%;font-size:14px;border:1px solid #e2e8f0">${tr}</table>
${extra}
<p style="font-size:12px;color:#64748b;margin-top:24px">${footer}</p>
</div></div></body></html>`;
}

function textBlock(table: [string, string][]) {
  return table.map(([k, v]) => `${k}: ${v}`).join("\n");
}

const typeVerb: Record<HrRequestType, string> = {
  JOINER: "set up IT access and equipment for a new joiner",
  LEAVER: "offboard a leaving employee",
  ASSET_ALLOCATION: "allocate IT equipment to an employee",
  ASSET_RETURN: "collect IT equipment from an employee",
};

/** HR → IT: the formal request. This stored email is the official audit record. */
export function requestSubmittedEmail(req: Req, raisedBy: { name: string; email: string }) {
  const subject = `[${req.reference}] ${REQUEST_TYPE_LABELS[req.type]} request – ${req.employeeName}${req.employeeNumber ? ` (${req.employeeNumber})` : ""}`;
  const table = rows(req);
  const details = req.details?.trim() || "None";
  const link = `${config.appUrl}/requests/${encodeURIComponent(req.reference)}`;
  const text = `Dear IT Team,

HR formally requests IT to ${typeVerb[req.type]}.

${textBlock(table)}

Details / requirements:
${details}

Requested by: ${raisedBy.name} (${raisedBy.email}), HR
Submitted: ${fmtDateTime(req.createdAt)}
Reference: ${req.reference}

Open in the IT portal: ${link}

This email was sent from the ${config.orgName} IT Portal and is kept as the official record of this request.`;
  const html = layout(
    `${REQUEST_TYPE_LABELS[req.type]} request · ${req.reference}`,
    `Dear IT Team,<br><br>HR formally requests IT to <b>${escapeHtml(typeVerb[req.type])}</b>.`,
    table,
    `<p style="margin-top:16px"><b>Details / requirements</b><br>${escapeHtml(details).replace(/\n/g, "<br>")}</p>
<p>Requested by: <b>${escapeHtml(raisedBy.name)}</b> (${escapeHtml(raisedBy.email)}), HR<br>Submitted: ${escapeHtml(fmtDateTime(req.createdAt))}<br>Reference: <b>${escapeHtml(req.reference)}</b></p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#62B8AE;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open in IT portal</a></p>`,
    `Sent from the ${escapeHtml(config.orgName)} IT Portal. This email is kept as the official record of the request.`,
  );
  return { subject, text, html };
}

/** IT → HR: confirmation that the request was completed (or cancelled). */
export function requestClosedEmail(
  req: Req,
  outcome: "COMPLETED" | "CANCELLED",
  by: { name: string; email: string },
  note: string,
) {
  const verb = outcome === "COMPLETED" ? "Completed" : "Cancelled";
  const subject = `[${req.reference}] ${REQUEST_TYPE_LABELS[req.type]} ${verb} – ${req.employeeName}${req.employeeNumber ? ` (${req.employeeNumber})` : ""}`;
  const table = rows(req);
  const when = fmtDateTime(new Date());
  const text = `Dear HR,

As per your request dated ${fmtDate(req.createdAt)} (${req.reference}), IT has ${outcome === "COMPLETED" ? "completed" : "cancelled"} the following ${REQUEST_TYPE_LABELS[req.type].toLowerCase()} request.

${textBlock(table)}

${outcome === "COMPLETED" ? "Summary of work" : "Reason"}:
${note || "—"}

${verb} by: ${by.name} on ${when}
Reference: ${req.reference}

Sent from the ${config.orgName} IT Portal.`;
  const html = layout(
    `${REQUEST_TYPE_LABELS[req.type]} ${verb} · ${req.reference}`,
    `Dear HR,<br><br>As per your request dated ${escapeHtml(fmtDate(req.createdAt))}, IT has <b>${outcome === "COMPLETED" ? "completed" : "cancelled"}</b> the following request.`,
    table,
    `<p style="margin-top:16px"><b>${outcome === "COMPLETED" ? "Summary of work" : "Reason"}</b><br>${escapeHtml(note || "—").replace(/\n/g, "<br>")}</p>
<p>${verb} by: <b>${escapeHtml(by.name)}</b> on ${escapeHtml(when)}<br>Reference: <b>${escapeHtml(req.reference)}</b></p>`,
    `Sent from the ${escapeHtml(config.orgName)} IT Portal.`,
  );
  return { subject, text, html };
}

export function signInCodeEmail(code: string) {
  const subject = `${config.orgShort} IT Portal sign-in code: ${code}`;
  const text = `Your sign-in code for the ${config.orgName} IT Portal is:

${code}

It expires in 10 minutes. If you did not try to sign in, ignore this email and tell the IT team.`;
  const html = layout(
    "IT Portal sign-in code",
    `Your sign-in code is:<br><span style="font-size:28px;letter-spacing:6px;font-weight:bold;color:#6B2D62">${escapeHtml(code)}</span><br><br>It expires in 10 minutes.`,
    [],
    "",
    "If you did not try to sign in, ignore this email and tell the IT team.",
  );
  return { subject, text, html };
}

export function welcomeEmail(user: { name: string; email: string }, roleLabel: string) {
  const subject = `You have been added to the ${config.orgShort} IT Portal`;
  const text = `Hello ${user.name},

You have been given ${roleLabel} access to the ${config.orgName} IT Portal.

Sign in at ${config.appUrl}/login with this email address. You will get a one-time code by email, and on first sign-in you will set up an authenticator app (Microsoft Authenticator, Google Authenticator or similar) for two-step verification.

The portal does not use passwords.`;
  const html = layout(
    "Welcome to the IT Portal",
    `Hello ${escapeHtml(user.name)},<br><br>You have been given <b>${escapeHtml(roleLabel)}</b> access to the ${escapeHtml(config.orgName)} IT Portal.<br><br>Sign in at <a href="${escapeHtml(config.appUrl)}/login">${escapeHtml(config.appUrl)}/login</a> with this email address. You'll receive a one-time code by email, and on first sign-in you'll set up an authenticator app for two-step verification. The portal does not use passwords.`,
    [],
    "",
    `Sent from the ${escapeHtml(config.orgName)} IT Portal.`,
  );
  return { subject, text, html };
}
