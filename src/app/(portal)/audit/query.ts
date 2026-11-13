import type { Prisma } from "@prisma/client";

export type AuditFilters = { q?: string; entity?: string; action?: string; actor?: string; from?: string; to?: string };

export function auditWhere(sp: AuditFilters): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (sp.q) where.summary = { contains: sp.q.trim(), mode: "insensitive" };
  if (sp.entity) where.entityType = sp.entity;
  if (sp.action) where.action = sp.action;
  if (sp.actor) where.actorEmail = { contains: sp.actor.trim(), mode: "insensitive" };
  const at: Prisma.DateTimeFilter = {};
  if (sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)) at.gte = new Date(sp.from + "T00:00:00+04:00");
  if (sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)) at.lte = new Date(sp.to + "T23:59:59.999+04:00");
  if (at.gte || at.lte) where.at = at;
  return where;
}
