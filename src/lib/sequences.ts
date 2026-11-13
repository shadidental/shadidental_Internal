import type { AssetCategory, Prisma } from "@prisma/client";
import { config } from "./config";
import { CATEGORY_CODES } from "./labels";

export function formatAssetTag(prefix: string, category: AssetCategory, n: number): string {
  return `${prefix}-${CATEGORY_CODES[category]}-${String(n).padStart(4, "0")}`;
}

export function formatRequestRef(year: number, n: number): string {
  return `REQ-${year}-${String(n).padStart(4, "0")}`;
}

/** Atomically reserve the next asset tag for a category (inside a transaction). */
export async function nextAssetTag(tx: Prisma.TransactionClient, category: AssetCategory): Promise<string> {
  // Upsert then increment returns the reserved number with a row lock, so two
  // people adding laptops at once never get the same tag.
  for (;;) {
    const row = await tx.assetTagCounter.upsert({
      where: { category },
      create: { category, next: 2 },
      update: { next: { increment: 1 } },
    });
    const n = row.next - 1;
    const tag = formatAssetTag(config.assetTagPrefix, category, n);
    // Skip numbers already used by imported tags.
    const clash = await tx.asset.findUnique({ where: { assetTag: tag }, select: { id: true } });
    if (!clash) return tag;
  }
}

export async function nextRequestRef(tx: Prisma.TransactionClient): Promise<string> {
  const year = Number(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" }).slice(0, 4));
  const row = await tx.requestCounter.upsert({
    where: { year },
    create: { year, next: 2 },
    update: { next: { increment: 1 } },
  });
  return formatRequestRef(year, row.next - 1);
}
