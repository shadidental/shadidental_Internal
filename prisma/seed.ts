/**
 * First-time setup: creates the first IT Admin and default branches.
 *   SEED_ADMIN_EMAIL=you@clinic.ae SEED_ADMIN_NAME="Your Name" npm run db:seed
 * Add SEED_DEMO=true to also create demo users/data for testing.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || "").trim().toLowerCase();
  const name = process.env.SEED_ADMIN_NAME || "IT Admin";
  if (!email) throw new Error("Set SEED_ADMIN_EMAIL to the first IT Admin's email address.");

  const existed = await db.portalUser.findUnique({ where: { email } });
  const admin = await db.portalUser.upsert({
    where: { email },
    create: { email, name, role: "ADMIN" },
    update: {}, // never re-promote or re-activate on later runs (e.g. every deploy)
  });
  console.log(`IT Admin: ${admin.email}`);

  const branches = (process.env.SEED_BRANCHES || "Head Office:HO").split(",").map((s) => s.trim()).filter(Boolean);
  for (const b of branches) {
    const [bname, code] = b.split(":");
    await db.branch.upsert({ where: { code: code.toUpperCase() }, create: { name: bname, code: code.toUpperCase() }, update: {} });
  }
  if (!existed) {
    await db.auditLog.create({ data: { action: "SEED", entityType: "PortalUser", entityId: admin.id, summary: `Initial setup: ${admin.email} made IT Admin` } });
  }

  if (process.env.SEED_DEMO === "true") {
    const domain = email.split("@")[1];
    const it = await db.portalUser.upsert({ where: { email: `it.staff@${domain}` }, create: { email: `it.staff@${domain}`, name: "Demo IT Staff", role: "IT_STAFF" }, update: {} });
    const hr = await db.portalUser.upsert({ where: { email: `hr@${domain}` }, create: { email: `hr@${domain}`, name: "Demo HR Officer", role: "HR" }, update: {} });
    const ho = await db.branch.findFirstOrThrow();
    const emps = [
      ["E1001", "Aisha Al Mansoori", "Dentist", "Clinical"],
      ["E1002", "Rahul Menon", "Receptionist", "Front Desk"],
      ["E1003", "Maria Santos", "Dental Nurse", "Clinical"],
    ];
    for (const [employeeId, fullName, jobTitle, department] of emps) {
      await db.employee.upsert({ where: { employeeId }, create: { employeeId, fullName, jobTitle, department, branchId: ho.id, startDate: new Date("2024-01-15") }, update: {} });
    }
    console.log(`Demo users: ${it.email} (IT Staff), ${hr.email} (HR)`);
  }
}

main().finally(() => db.$disconnect());
