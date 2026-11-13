import { ActionForm } from "@/components/ActionForm";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createEmployee } from "../actions";
import { EmployeeFields } from "../EmployeeFields";

export const metadata = { title: "Add employee" };

export default async function NewEmployeePage() {
  await requireUser("employees:edit");
  const branches = await db.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader title="Add employee" subtitle="Keep personal data to what IT needs." />
      <Card>
        <ActionForm action={createEmployee} submitLabel="Add employee" pendingText="Saving…">
          <EmployeeFields branches={branches} />
        </ActionForm>
      </Card>
    </>
  );
}
