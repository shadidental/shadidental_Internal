import type { AssetCategory, AssetStatus, Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { csvResponse, toCsv } from "@/lib/csv";
import { ASSET_STATUS_LABELS, CATEGORY_LABELS } from "@/lib/labels";
import { audit } from "@/lib/audit";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "assets:view")) return new Response("Forbidden", { status: 403 });
  const sp = new URL(req.url).searchParams;
  const where: Prisma.AssetWhereInput = {};
  const status = sp.get("status"), category = sp.get("category"), branch = sp.get("branch");
  if (status && status in ASSET_STATUS_LABELS) where.status = status as AssetStatus;
  if (category && category in CATEGORY_LABELS) where.category = category as AssetCategory;
  if (branch) where.branchId = branch;
  const assets = await db.asset.findMany({ where, include: { branch: true, currentOwner: true }, orderBy: { assetTag: "asc" } });
  const rows = assets.map((a) => [
    a.assetTag, CATEGORY_LABELS[a.category], a.make, a.model, a.serialNumber, a.branch?.name, ASSET_STATUS_LABELS[a.status],
    a.currentOwner?.employeeId, a.currentOwner?.fullName, a.purchaseDate, a.vendor, a.purchaseCost?.toString(), a.invoiceRef,
    a.warrantyExpiry, a.conditionNotes,
  ]);
  await audit({ actor: user, action: "EXPORT", entityType: "Asset", summary: `Exported ${rows.length} assets to CSV` });
  return csvResponse(
    `assets-${new Date().toISOString().slice(0, 10)}.csv`,
    toCsv(["Asset tag", "Category", "Make", "Model", "Serial number", "Branch", "Status", "Owner employee ID", "Owner name",
      "Purchase date", "Vendor", "Purchase cost (AED)", "Invoice ref", "Warranty expiry", "Condition notes"], rows),
  );
}
