import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateAsset } from "../../actions";
import { AssetFields } from "../../AssetFields";

export const metadata = { title: "Edit asset" };

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("assets:edit");
  const { id } = await params;
  const [asset, branches] = await Promise.all([
    db.asset.findUnique({ where: { id } }),
    db.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!asset) notFound();
  return (
    <>
      <PageHeader title={`Edit ${asset.assetTag}`} subtitle="Every change is recorded in the audit log with old and new values." />
      <Card>
        <ActionForm action={updateAsset.bind(null, id)} submitLabel="Save changes" pendingText="Saving…">
          <AssetFields asset={asset} branches={branches} />
        </ActionForm>
      </Card>
    </>
  );
}
