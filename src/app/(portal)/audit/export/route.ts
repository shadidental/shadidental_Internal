import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { csvResponse, toCsv } from "@/lib/csv";
import { audit } from "@/lib/audit";
import { auditWhere } from "../query";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "audit:export")) return new Response("Forbidden", { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const rows = await db.auditLog.findMany({ where: auditWhere(sp), orderBy: { at: "asc" }, take: 100_000 });
  await audit({ actor: user, action: "EXPORT", entityType: "AuditLog", summary: `Exported ${rows.length} audit entries to CSV` });
  return csvResponse(`audit-log-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(
    ["ID", "When (UTC)", "User", "Action", "Record type", "Record ID", "Summary", "Old value", "New value"],
    rows.map((r) => [r.id.toString(), r.at.toISOString(), r.actorEmail, r.action, r.entityType, r.entityId, r.summary,
      r.before ? JSON.stringify(r.before) : "", r.after ? JSON.stringify(r.after) : ""]),
  ));
}
