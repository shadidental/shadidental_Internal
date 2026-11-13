import { Card, Notice, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ImportClient } from "./ImportClient";

export const metadata = { title: "Import from Excel" };

export default async function ImportPage() {
  await requireUser("import:run");
  return (
    <>
      <PageHeader title="Import from Excel" subtitle="Move the existing Excel tracking sheets into the portal." />
      <Notice>
        Import <b>employees first</b>, then assets, so assets can be linked to their owners by Employee ID. Nothing is saved until you
        click Import, and existing records are never overwritten.
      </Notice>
      <Card><ImportClient /></Card>
    </>
  );
}
