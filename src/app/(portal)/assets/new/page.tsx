import { ActionForm } from "@/components/ActionForm";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { createAsset } from "../actions";
import { AssetFields } from "../AssetFields";

export const metadata = { title: "Add asset" };

export default async function NewAssetPage() {
  await requireUser("assets:edit");
  const branches = await db.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader title="Add asset" subtitle={`The asset tag (e.g. ${config.assetTagPrefix}-LT-0001) is generated automatically.`} />
      <Card>
        <ActionForm action={createAsset} submitLabel="Add asset" pendingText="Saving…">
          <AssetFields branches={branches} />
        </ActionForm>
      </Card>
    </>
  );
}
