"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { nextAssetTag } from "@/lib/sequences";
import { findHeaderRow, readSpreadsheet } from "@/lib/spreadsheet";
import { todayDate } from "@/lib/format";
import {
  type AssetRow, type EmployeeRow, type ImportKind, type RowResult,
  fieldsFor, mapHeaders, markDuplicates, validateAssetRow, validateEmployeeRow,
} from "@/lib/import";

const MAX_ROWS = 5000;

export type Preview = {
  kind: ImportKind;
  fileName: string;
  headers: string[];
  mapping: Record<number, string>;
  unmapped: string[];
  missing: string[];
  results: RowResult<AssetRow | EmployeeRow>[];
  error?: string;
};

async function analyse(kind: ImportKind, rows: unknown[][], fileName: string): Promise<Preview> {
  const h = findHeaderRow(rows);
  const headers = (rows[h] ?? []).map((c) => String(c ?? "").trim());
  const { mapping, unmapped, missing } = mapHeaders(headers, kind);
  const body = rows.slice(h + 1, h + 1 + MAX_ROWS);
  const base = { kind, fileName, headers, mapping, unmapped, missing };
  if (missing.length) return { ...base, results: [], error: `Couldn't find column(s): ${missing.join(", ")}. Rename the header in the file and upload again.` };

  if (kind === "employees") {
    const results = body.map((r, i) => validateEmployeeRow(r, mapping, h + i + 2));
    markDuplicates(results, (d) => d.employeeId, "Employee ID");
    const ids = results.flatMap((r) => (r.data ? [r.data.employeeId] : []));
    const existing = new Set((await db.employee.findMany({ where: { employeeId: { in: ids } }, select: { employeeId: true } })).map((e) => e.employeeId));
    for (const r of results) if (r.data && existing.has(r.data.employeeId)) r.warnings.push("Already in the portal – will be skipped");
    return { ...base, results };
  }

  const results = body.map((r, i) => validateAssetRow(r, mapping, h + i + 2));
  markDuplicates(results, (d) => d.serialNumber, "Serial number");
  markDuplicates(results, (d) => d.assetTag, "Asset tag");
  const serials = results.flatMap((r) => (r.data?.serialNumber ? [r.data.serialNumber] : []));
  const tags = results.flatMap((r) => (r.data?.assetTag ? [r.data.assetTag] : []));
  const [bySerial, byTag, emps] = await Promise.all([
    db.asset.findMany({ where: { serialNumber: { in: serials } }, select: { serialNumber: true } }),
    db.asset.findMany({ where: { assetTag: { in: tags } }, select: { assetTag: true } }),
    db.employee.findMany({ select: { employeeId: true, fullName: true, status: true } }),
  ]);
  const serialSet = new Set(bySerial.map((a) => a.serialNumber!.toLowerCase()));
  const tagSet = new Set(byTag.map((a) => a.assetTag));
  const empIds = new Map(emps.map((e) => [e.employeeId.toLowerCase(), e]));
  const empNames = new Map<string, number>();
  emps.forEach((e) => empNames.set(e.fullName.toLowerCase(), (empNames.get(e.fullName.toLowerCase()) ?? 0) + 1));
  for (const r of results) {
    const d = r.data as AssetRow | null;
    if (!d) continue;
    if (d.serialNumber && serialSet.has(d.serialNumber.toLowerCase())) r.warnings.push("Serial number already in the portal – will be skipped");
    if (d.assetTag && tagSet.has(d.assetTag)) r.warnings.push(`Tag ${d.assetTag} already used – a new tag will be generated`);
    if (d.ownerEmployeeId && !empIds.has(d.ownerEmployeeId.toLowerCase())) r.warnings.push(`Employee ID ${d.ownerEmployeeId} not found – asset will be imported as In stock. Import employees first.`);
    else if (!d.ownerEmployeeId && d.ownerName) {
      const n = empNames.get(d.ownerName.toLowerCase()) ?? 0;
      if (n !== 1) r.warnings.push(n ? `More than one employee is named “${d.ownerName}” – imported as In stock` : `No employee named “${d.ownerName}” – imported as In stock`);
    }
  }
  return { ...base, results };
}

export async function previewImport(_: Preview | undefined, form: FormData): Promise<Preview> {
  await requireUser("import:run");
  const kind = form.get("kind") === "employees" ? "employees" : "assets";
  const file = form.get("file");
  const empty: Preview = { kind, fileName: "", headers: [], mapping: {}, unmapped: [], missing: [], results: [] };
  if (!(file instanceof File) || file.size === 0) return { ...empty, error: "Choose a file to upload." };
  if (file.size > 8 * 1024 * 1024) return { ...empty, error: "File is larger than 8 MB." };
  try {
    const rows = await readSpreadsheet(file);
    if (rows.length < 2) return { ...empty, fileName: file.name, error: "The file has no data rows." };
    return analyse(kind, rows, file.name);
  } catch (e) {
    return { ...empty, fileName: file.name, error: (e as Error).message || "Couldn't read that file." };
  }
}

export type CommitResult = { ok?: string; error?: string };

/** Re-reads and re-validates the file server-side, then imports valid rows. */
export async function commitImport(_: CommitResult | undefined, form: FormData): Promise<CommitResult> {
  const user = await requireUser("import:run");
  const kind = form.get("kind") === "employees" ? "employees" : "assets";
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose the file again." };
  const preview = await analyse(kind, await readSpreadsheet(file), file.name);
  if (preview.error) return { error: preview.error };
  const valid = preview.results.filter((r) => r.data);

  const branches = await db.branch.findMany();
  const branchByKey = new Map<string, string>();
  branches.forEach((b) => { branchByKey.set(b.name.toLowerCase(), b.id); branchByKey.set(b.code.toLowerCase(), b.id); });
  const newBranches: string[] = [];
  async function branchId(tx: Prisma.TransactionClient, name: string | null) {
    if (!name) return null;
    const k = name.toLowerCase();
    if (branchByKey.has(k)) return branchByKey.get(k)!;
    let code = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase() || "BR";
    while (branches.some((b) => b.code === code) || [...branchByKey.keys()].includes(code.toLowerCase())) code = code.slice(0, 5) + Math.floor(Math.random() * 10);
    const b = await tx.branch.create({ data: { name, code } });
    branchByKey.set(k, b.id); branchByKey.set(code.toLowerCase(), b.id);
    newBranches.push(name);
    await audit({ actor: user, action: "CREATE", entityType: "Branch", entityId: b.id, summary: `Added branch ${name} (from import)` }, tx);
    return b.id;
  }

  let created = 0, skipped = 0, assigned = 0;
  const date = (s: string | null) => (s ? new Date(s + "T00:00:00Z") : null);
  try {
    await db.$transaction(async (tx) => {
      if (kind === "employees") {
        for (const r of valid) {
          const d = r.data as EmployeeRow;
          if (await tx.employee.findUnique({ where: { employeeId: d.employeeId } })) { skipped++; continue; }
          const e = await tx.employee.create({
            data: {
              employeeId: d.employeeId, fullName: d.fullName, email: d.email, jobTitle: d.jobTitle, department: d.department,
              branchId: await branchId(tx, d.branch), lineManager: d.lineManager, startDate: date(d.startDate), endDate: date(d.endDate), status: d.status,
            },
          });
          await audit({ actor: user, action: "IMPORT", entityType: "Employee", entityId: e.id, summary: `Imported employee ${e.fullName} (${e.employeeId}) from ${file.name} row ${r.line}`, after: e }, tx);
          created++;
        }
      } else {
        const emps = await tx.employee.findMany({ select: { id: true, employeeId: true, fullName: true, status: true } });
        const byId = new Map(emps.map((e) => [e.employeeId.toLowerCase(), e]));
        const byName = new Map<string, typeof emps>();
        emps.forEach((e) => byName.set(e.fullName.toLowerCase(), [...(byName.get(e.fullName.toLowerCase()) ?? []), e]));
        for (const r of valid) {
          const d = r.data as AssetRow;
          if (d.serialNumber && (await tx.asset.findFirst({ where: { serialNumber: { equals: d.serialNumber, mode: "insensitive" } } }))) { skipped++; continue; }
          let tag = d.assetTag;
          if (!tag || (await tx.asset.findUnique({ where: { assetTag: tag } }))) tag = await nextAssetTag(tx, d.category);
          const owner = d.ownerEmployeeId ? byId.get(d.ownerEmployeeId.toLowerCase()) : d.ownerName && byName.get(d.ownerName.toLowerCase())?.length === 1 ? byName.get(d.ownerName.toLowerCase())![0] : undefined;
          const status = owner ? "ASSIGNED" : d.status && d.status !== "ASSIGNED" ? d.status : "IN_STOCK";
          const a = await tx.asset.create({
            data: {
              assetTag: tag, category: d.category, make: d.make, model: d.model, serialNumber: d.serialNumber,
              purchaseDate: date(d.purchaseDate), vendor: d.vendor, purchaseCost: d.purchaseCost, invoiceRef: d.invoiceRef,
              warrantyExpiry: date(d.warrantyExpiry), branchId: await branchId(tx, d.branch), status,
              currentOwnerId: owner?.id ?? null, conditionNotes: d.conditionNotes,
            },
          });
          if (owner) {
            await tx.assetAssignment.create({ data: { assetId: a.id, employeeId: owner.id, assignedAt: date(d.assignedDate) ?? todayDate(), assignedById: user.id, conditionOut: "Imported from Excel" } });
            assigned++;
          }
          await audit({ actor: user, action: "IMPORT", entityType: "Asset", entityId: a.id, summary: `Imported ${tag} from ${file.name} row ${r.line}${owner ? ` (assigned to ${owner.fullName})` : ""}`, after: a }, tx);
          created++;
        }
      }
      await audit({ actor: user, action: "IMPORT", entityType: kind === "assets" ? "Asset" : "Employee", summary: `Imported ${created} ${kind} from ${file.name} (${skipped} skipped, ${preview.results.length - valid.length} rows with errors)` }, tx);
    }, { timeout: 120_000, maxWait: 10_000 });
  } catch (e) {
    console.error(e);
    return { error: "Import failed and nothing was saved: " + ((e as Error).message ?? "unknown error") };
  }
  revalidatePath(`/${kind}`);
  return {
    ok: `Imported ${created} ${kind}${kind === "assets" ? ` (${assigned} assigned to employees)` : ""}. ${skipped} already existed and were skipped. ${preview.results.length - valid.length} rows had errors and were not imported.${newBranches.length ? ` New branches added: ${newBranches.join(", ")}.` : ""}`,
  };
}
