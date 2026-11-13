import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";

type Tx = Prisma.TransactionClient | PrismaClient;

export type AuditInput = {
  actor?: { id: string; email: string } | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  before?: unknown;
  after?: unknown;
};

/** Make values JSON-safe (Dates, Decimals, BigInts). */
function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
}

/** Only keep fields that actually changed, so the log shows old → new clearly. */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    const ov = norm(before[key]);
    const nv = norm(after[key]);
    if (JSON.stringify(ov) !== JSON.stringify(nv)) {
      b[key] = ov;
      a[key] = nv;
    }
  }
  return { before: b, after: a, changed: Object.keys(a) };
}

function norm(v: unknown) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return String(Number(v));
  if (v && typeof v === "object" && "toFixed" in v) return String(Number(v)); // Decimal
  if (v === "" || v === undefined) return null;
  return v;
}

export async function audit(entry: AuditInput, tx: Tx = db) {
  await tx.auditLog.create({
    data: {
      actorId: entry.actor?.id ?? null,
      actorEmail: entry.actor?.email ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
      before: toJson(entry.before),
      after: toJson(entry.after),
    },
  });
}
