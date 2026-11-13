import Link from "next/link";
import type { Prisma, AssetCategory, AssetStatus } from "@prisma/client";
import { Badge, Card, Empty, PageHeader, Pager } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ASSET_STATUS_LABELS, ASSET_STATUS_STYLES, CATEGORY_LABELS } from "@/lib/labels";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Assets" };
const PAGE_SIZE = 50;

type SP = { q?: string; status?: string; category?: string; branch?: string; page?: string; warranty?: string };

export default async function AssetsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("assets:view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.AssetWhereInput = {};
  if (sp.q) {
    const q = sp.q.trim();
    where.OR = [
      { assetTag: { contains: q, mode: "insensitive" } },
      { serialNumber: { contains: q, mode: "insensitive" } },
      { make: { contains: q, mode: "insensitive" } },
      { model: { contains: q, mode: "insensitive" } },
      { currentOwner: { fullName: { contains: q, mode: "insensitive" } } },
      { currentOwner: { employeeId: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (sp.status && sp.status in ASSET_STATUS_LABELS) where.status = sp.status as AssetStatus;
  if (sp.category && sp.category in CATEGORY_LABELS) where.category = sp.category as AssetCategory;
  if (sp.branch) where.branchId = sp.branch;
  if (sp.warranty === "30") {
    const now = new Date();
    where.warrantyExpiry = { gte: now, lte: new Date(now.getTime() + 30 * 86400_000) };
    where.status = { notIn: ["RETIRED", "LOST_STOLEN"] };
  }

  const [assets, total, branches] = await Promise.all([
    db.asset.findMany({
      where, include: { branch: true, currentOwner: true },
      orderBy: { assetTag: "asc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    }),
    db.asset.count({ where }),
    db.branch.findMany({ orderBy: { name: "asc" } }),
  ]);
  const base = new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== "page" && v) as [string, string][]);

  return (
    <>
      <PageHeader
        title="Assets"
        subtitle={`${total} asset${total === 1 ? "" : "s"}${sp.warranty === "30" ? " with warranty ending in the next 30 days" : ""}`}
        actions={
          <>
            <a className="btn-outline" href={`/assets/export?${base}`}>Export CSV</a>
            {can(user.role, "assets:edit") && <Link className="btn-primary" href="/assets/new">+ Add asset</Link>}
          </>
        }
      />
      <Card>
        <form className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <input name="q" defaultValue={sp.q} placeholder="Search tag, serial, model, owner…" className="input lg:col-span-2" />
          <select name="status" defaultValue={sp.status ?? ""} className="input">
            <option value="">All statuses</option>
            {Object.entries(ASSET_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select name="category" defaultValue={sp.category ?? ""} className="input">
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <div className="flex gap-2">
            <select name="branch" defaultValue={sp.branch ?? ""} className="input">
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <button className="btn-teal">Filter</button>
          </div>
        </form>
        {assets.length === 0 ? (
          <Empty>No assets match. {can(user.role, "assets:edit") && <>Add one, or <Link className="link" href="/import">import from Excel</Link>.</>}</Empty>
        ) : (
          <div className="-mx-4 overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Tag</th><th>Category</th><th>Make / model</th><th>Serial</th><th>Branch</th><th>Owner</th><th>Status</th><th>Warranty</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets.map((a) => (
                  <tr key={a.id}>
                    <td><Link className="link font-mono" href={`/assets/${a.id}`}>{a.assetTag}</Link></td>
                    <td>{CATEGORY_LABELS[a.category]}</td>
                    <td>{[a.make, a.model].filter(Boolean).join(" ") || "—"}</td>
                    <td className="font-mono text-xs">{a.serialNumber ?? "—"}</td>
                    <td>{a.branch?.name ?? "—"}</td>
                    <td>{a.currentOwner ? <Link className="link" href={`/employees/${a.currentOwner.id}`}>{a.currentOwner.fullName}</Link> : "—"}</td>
                    <td><Badge className={ASSET_STATUS_STYLES[a.status]}>{ASSET_STATUS_LABELS[a.status]}</Badge></td>
                    <td className="whitespace-nowrap">{fmtDate(a.warrantyExpiry)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pages={Math.ceil(total / PAGE_SIZE)} base={base} />
      </Card>
    </>
  );
}
