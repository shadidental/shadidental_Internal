import type { EmployeeStatus, Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { csvResponse, toCsv } from "@/lib/csv";
import { audit } from "@/lib/audit";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "employees:view")) return new Response("Forbidden", { status: 403 });
  const sp = new URL(req.url).searchParams;
  const where: Prisma.EmployeeWhereInput = {};
  const status = sp.get("status");
  if (status === "ACTIVE" || status === "LEFT") where.status = status as EmployeeStatus;
  if (sp.get("branch")) where.branchId = sp.get("branch")!;
  const rows = await db.employee.findMany({ where, include: { branch: true, assetsHeld: true }, orderBy: { fullName: "asc" } });
  await audit({ actor: user, action: "EXPORT", entityType: "Employee", summary: `Exported ${rows.length} employees to CSV` });
  return csvResponse(`employees-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(
    ["Employee ID", "Full name", "Email", "Job title", "Department", "Branch", "Line manager", "Start date", "End date", "Status", "Assets held"],
    rows.map((e) => [e.employeeId, e.fullName, e.email, e.jobTitle, e.department, e.branch?.name, e.lineManager, e.startDate, e.endDate, e.status, e.assetsHeld.map((a) => a.assetTag).join(" ")]),
  ));
}
