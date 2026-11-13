import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { RequestForm } from "./RequestForm";

export const metadata = { title: "New request" };

export default async function NewRequestPage() {
  await requireUser("requests:create");
  const [employees, branches] = await Promise.all([
    db.employee.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, employeeId: true, department: true } }),
    db.branch.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  return (
    <>
      <PageHeader title="New request to IT" subtitle="For new joiners, leavers and equipment. IT is notified by email straight away." />
      <Card><RequestForm employees={employees} branches={branches.map((b) => b.name)} /></Card>
    </>
  );
}
