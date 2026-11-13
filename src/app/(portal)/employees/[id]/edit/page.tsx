import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateEmployee } from "../../actions";
import { EmployeeFields } from "../../EmployeeFields";

export const metadata = { title: "Edit employee" };

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("employees:edit");
  const { id } = await params;
  const [e, branches] = await Promise.all([
    db.employee.findUnique({ where: { id } }),
    db.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!e) notFound();
  return (
    <>
      <PageHeader title={`Edit ${e.fullName}`} />
      <Card>
        <ActionForm action={updateEmployee.bind(null, id)} submitLabel="Save changes" pendingText="Saving…">
          <EmployeeFields e={e} branches={branches} />
        </ActionForm>
      </Card>
    </>
  );
}
