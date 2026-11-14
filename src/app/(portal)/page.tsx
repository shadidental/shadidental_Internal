import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { HistoryList } from "@/components/HistoryList";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ASSET_STATUS_LABELS, CATEGORY_LABELS, REQUEST_STATUS_LABELS, REQUEST_STATUS_STYLES, REQUEST_TYPE_LABELS } from "@/lib/labels";
import { fmtDate, fmtDateTime } from "@/lib/format";
import type { AssetStatus } from "@prisma/client";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const user = await requireUser();
  const isHR = user.role === "HR";
  const showStats = !isHR && can(user.role, "assets:view");
  const openWhere = { status: { in: ["SUBMITTED", "IN_PROGRESS"] as ("SUBMITTED" | "IN_PROGRESS")[] } };
  // Start every query at once so the page waits for one round trip, not six.
  const in30 = new Date(Date.now() + 30 * 86400_000);
  const statsPromise = showStats
    ? Promise.all([
        db.asset.groupBy({ by: ["status"], _count: true }),
        db.asset.groupBy({ by: ["category"], _count: true, orderBy: { _count: { category: "desc" } } }),
        db.employee.count({ where: { status: "ACTIVE" } }),
        db.asset.findMany({ where: { warrantyExpiry: { gte: new Date(), lte: in30 }, status: { notIn: ["RETIRED", "LOST_STOLEN"] } }, orderBy: { warrantyExpiry: "asc" }, take: 8 }),
        can(user.role, "audit:view") ? db.auditLog.findMany({ where: { action: { notIn: ["LOGIN", "LOGOUT"] } }, orderBy: { at: "desc" }, take: 8 }) : Promise.resolve([]),
      ])
    : null;
  const [openReqs, openCount] = await Promise.all([
    db.hrRequest.findMany({ where: openWhere, include: { raisedBy: true, assignedTo: true }, orderBy: { createdAt: "asc" }, take: 10 }),
    db.hrRequest.count({ where: openWhere }),
  ]);

  const requestsCard = (
    <Card title={`Open requests (${openCount})`} actions={<Link className="link text-sm" href="/requests">View all</Link>}>
      {openReqs.length === 0 ? <p className="text-sm text-slate-500">Nothing open. 🎉</p> : (
        <ul className="divide-y divide-slate-100">
          {openReqs.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                <Link className="link font-mono" href={`/requests/${r.reference}`}>{r.reference}</Link> · {REQUEST_TYPE_LABELS[r.type]} · {r.employeeName}
                <span className="block text-xs text-slate-500">by {r.raisedBy.name}, {fmtDateTime(r.createdAt)}{r.effectiveDate && ` · needed ${fmtDate(r.effectiveDate)}`}{r.assignedTo && ` · IT: ${r.assignedTo.name}`}</span>
              </span>
              <Badge className={REQUEST_STATUS_STYLES[r.status]}>{REQUEST_STATUS_LABELS[r.status]}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  if (!statsPromise) {
    return (
      <>
        <PageHeader title={`Hello, ${user.name.split(" ")[0]}`} subtitle="Raise joiner, leaver and equipment requests to IT and follow their progress."
          actions={can(user.role, "requests:create") && <Link className="btn-primary" href="/requests/new">+ New request</Link>} />
        <div className="grid gap-6 lg:grid-cols-2">{requestsCard}
          <Card title="How it works">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">
              <li>Click <b>New request</b> and fill in the form.</li>
              <li>The portal emails the IT team with you in copy. That email is the official record for audits.</li>
              <li>IT picks it up here; you can follow progress and reply in the conversation.</li>
              <li>When IT finishes, you receive a formal confirmation email.</li>
            </ol>
          </Card>
        </div>
      </>
    );
  }

  const [byStatus, byCategory, employees, warranty, recent] = await statsPromise;
  const count = (s: AssetStatus) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const total = byStatus.reduce((n, b) => n + b._count, 0);

  return (
    <>
      <PageHeader title="IT dashboard" subtitle={`Signed in as ${user.name}`} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Tile label="Open HR requests" value={openCount} href="/requests" accent />
        <Tile label="Assets" value={total} href="/assets" />
        <Tile label={ASSET_STATUS_LABELS.ASSIGNED} value={count("ASSIGNED")} href="/assets?status=ASSIGNED" />
        <Tile label={ASSET_STATUS_LABELS.IN_STOCK} value={count("IN_STOCK")} href="/assets?status=IN_STOCK" />
        <Tile label={ASSET_STATUS_LABELS.UNDER_REPAIR} value={count("UNDER_REPAIR")} href="/assets?status=UNDER_REPAIR" />
        <Tile label="Active employees" value={employees} href="/employees" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {requestsCard}
        <Card title="Warranty ending in 30 days" actions={<Link className="link text-sm" href="/assets?warranty=30">View all</Link>}>
          {warranty.length === 0 ? <p className="text-sm text-slate-500">None.</p> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {warranty.map((a) => (
                <li key={a.id} className="flex justify-between py-2">
                  <span><Link className="link font-mono" href={`/assets/${a.id}`}>{a.assetTag}</Link> · {[a.make, a.model].filter(Boolean).join(" ")}</span>
                  <span className="text-amber-700">{fmtDate(a.warrantyExpiry)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Assets by category">
          {byCategory.length === 0 ? <p className="text-sm text-slate-500">No assets yet. <Link className="link" href="/import">Import from Excel</Link>.</p> : (
            <ul className="space-y-2 text-sm">
              {byCategory.map((c) => (
                <li key={c.category}>
                  <div className="flex justify-between"><span>{CATEGORY_LABELS[c.category]}</span><span className="font-medium">{c._count}</span></div>
                  <div className="mt-1 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-brand-teal" style={{ width: `${(c._count / total) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {recent.length > 0 && <Card title="Recent activity" actions={<Link className="link text-sm" href="/audit">Audit log</Link>}><HistoryList entries={recent} /></Card>}
      </div>
    </>
  );
}

function Tile({ label, value, href, accent }: { label: string; value: number; href: string; accent?: boolean }) {
  return (
    <Link href={href} className={`card block p-4 transition hover:shadow-md ${accent ? "border-brand-plum bg-brand-plum text-white" : ""}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${accent ? "text-white/80" : "text-slate-500"}`}>{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </Link>
  );
}
