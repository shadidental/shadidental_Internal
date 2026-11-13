/**
 * Excel/CSV import: maps the clinic's existing spreadsheet columns onto portal
 * fields and validates each row. Pure functions (no DB) so they're unit-tested.
 */
import type { AssetCategory, AssetStatus } from "@prisma/client";

export type ImportKind = "assets" | "employees";

type FieldDef = { key: string; label: string; aliases: string[]; required?: boolean };

export const ASSET_FIELDS: FieldDef[] = [
  { key: "assetTag", label: "Asset tag", aliases: ["asset tag", "tag", "asset no", "asset number", "asset id", "asset code"] },
  { key: "category", label: "Category", aliases: ["category", "type", "asset type", "device type", "item", "device"], required: true },
  { key: "make", label: "Make", aliases: ["make", "brand", "manufacturer", "vendor brand"] },
  { key: "model", label: "Model", aliases: ["model", "model name", "model no", "model number"] },
  { key: "serialNumber", label: "Serial number", aliases: ["serial", "serial number", "serial no", "s/n", "sn", "service tag"] },
  { key: "purchaseDate", label: "Purchase date", aliases: ["purchase date", "purchased", "date purchased", "bought", "purchase"] },
  { key: "vendor", label: "Vendor", aliases: ["vendor", "supplier", "purchased from"] },
  { key: "purchaseCost", label: "Purchase cost", aliases: ["cost", "price", "purchase cost", "amount", "value", "cost aed", "price aed"] },
  { key: "invoiceRef", label: "Invoice ref", aliases: ["invoice", "invoice no", "invoice number", "invoice ref", "po", "po number"] },
  { key: "warrantyExpiry", label: "Warranty expiry", aliases: ["warranty", "warranty expiry", "warranty end", "warranty date", "warranty until"] },
  { key: "branch", label: "Branch", aliases: ["branch", "location", "site", "clinic", "office"] },
  { key: "status", label: "Status", aliases: ["status", "state", "condition status"] },
  { key: "ownerEmployeeId", label: "Owner employee ID", aliases: ["employee id", "emp id", "emp no", "employee no", "employee number", "staff id", "owner id", "assigned to id"] },
  { key: "ownerName", label: "Owner name", aliases: ["assigned to", "owner", "user", "employee", "employee name", "holder", "allocated to", "name"] },
  { key: "assignedDate", label: "Assigned date", aliases: ["assigned date", "date assigned", "issue date", "issued", "allocation date", "handover date"] },
  { key: "conditionNotes", label: "Notes", aliases: ["notes", "remarks", "comments", "condition", "comment"] },
];

export const EMPLOYEE_FIELDS: FieldDef[] = [
  { key: "employeeId", label: "Employee ID", aliases: ["employee id", "emp id", "emp no", "employee no", "employee number", "staff id", "staff no", "id"], required: true },
  { key: "fullName", label: "Full name", aliases: ["full name", "name", "employee name", "staff name", "employee"], required: true },
  { key: "email", label: "Email", aliases: ["email", "e-mail", "email address", "mail", "work email"] },
  { key: "jobTitle", label: "Job title", aliases: ["job title", "title", "designation", "position", "role"] },
  { key: "department", label: "Department", aliases: ["department", "dept", "division", "section"] },
  { key: "branch", label: "Branch", aliases: ["branch", "location", "site", "clinic", "office"] },
  { key: "lineManager", label: "Line manager", aliases: ["line manager", "manager", "reports to", "supervisor"] },
  { key: "startDate", label: "Start date", aliases: ["start date", "joining date", "date of joining", "doj", "joined", "join date", "hire date"] },
  { key: "endDate", label: "End date", aliases: ["end date", "leaving date", "last working day", "lwd", "exit date", "resignation date"] },
  { key: "status", label: "Status", aliases: ["status", "employment status", "active"] },
];

export const fieldsFor = (kind: ImportKind) => (kind === "assets" ? ASSET_FIELDS : EMPLOYEE_FIELDS);

export function normHeader(h: string): string {
  return h.toLowerCase().replace(/[_\-.#:()]+/g, " ").replace(/\s+/g, " ").trim();
}

/** header index → field key. Exact alias matches win over partial ones. */
export function mapHeaders(headers: string[], kind: ImportKind): { mapping: Record<number, string>; unmapped: string[]; missing: string[] } {
  const fields = fieldsFor(kind);
  const mapping: Record<number, string> = {};
  const used = new Set<string>();
  const norm = headers.map((h) => normHeader(String(h ?? "")));
  // Pass 1: exact alias.
  norm.forEach((h, i) => {
    const f = fields.find((f) => !used.has(f.key) && (f.aliases.includes(h) || normHeader(f.label) === h));
    if (f) { mapping[i] = f.key; used.add(f.key); }
  });
  const unmapped = headers.filter((h, i) => !(i in mapping) && String(h ?? "").trim() !== "").map(String);
  const missing = fields.filter((f) => f.required && !used.has(f.key)).map((f) => f.label);
  return { mapping, unmapped, missing };
}

// ─── value parsers ───────────────────────────────────────────────────────

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

/** Accepts Excel serials, Date objects, yyyy-mm-dd, dd/mm/yyyy (UAE style), dd-Mon-yyyy. Returns yyyy-mm-dd. */
export function parseDate(v: unknown): string | null | "invalid" {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? "invalid" : v.toISOString().slice(0, 10);
  if (typeof v === "number" || /^\d{5}(\.\d+)?$/.test(String(v).trim())) {
    const n = Number(v);
    if (n > 20000 && n < 80000) return new Date(Math.round((n - 25569) * 86400_000)).toISOString().slice(0, 10);
    return "invalid";
  }
  const s = String(v).trim();
  let y: number, m: number, d: number;
  let mt: RegExpMatchArray | null;
  if ((mt = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) [y, m, d] = [+mt[1], +mt[2], +mt[3]];
  else if ((mt = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) [d, m, y] = [+mt[1], +mt[2], +mt[3]];
  else if ((mt = s.match(/^(\d{1,2})[-\s/]([A-Za-z]{3,9})[-\s/,]+(\d{2,4})$/))) {
    const mon = MONTHS[mt[2].toLowerCase().slice(0, 4)] ?? MONTHS[mt[2].toLowerCase().slice(0, 3)];
    if (!mon) return "invalid";
    [d, m, y] = [+mt[1], mon, +mt[3]];
  } else return "invalid";
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return "invalid";
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return "invalid";
  return date.toISOString().slice(0, 10);
}

const CATEGORY_WORDS: [AssetCategory, RegExp][] = [
  ["LAPTOP", /laptop|notebook|macbook|ultrabook/],
  ["DESKTOP", /desktop|\bpc\b|workstation|tower|all.in.one|aio|imac|computer|cpu/],
  ["MONITOR", /monitor|screen|display|lcd|led/],
  ["TABLET", /tablet|ipad|tab\b/],
  ["PHONE", /phone|mobile|iphone|android|smartphone|ip phone|handset|landline|cordless/],
  ["PRINTER", /printer|scanner|copier|mfp|label maker|plotter/],
  ["NETWORK", /router|switch|firewall|access point|\bap\b|wifi|wi-fi|modem|network|nas|server|ups/],
  ["PERIPHERAL", /keyboard|mouse|headset|webcam|camera|dock|speaker|card reader|adapter|charger|peripheral|accessor/],
];

export function parseCategory(v: unknown): AssetCategory | null {
  const s = String(v ?? "").toLowerCase().trim();
  if (!s) return null;
  const exact = s.toUpperCase().replace(/\s+/g, "_");
  const all = ["LAPTOP", "DESKTOP", "MONITOR", "PHONE", "TABLET", "PRINTER", "NETWORK", "PERIPHERAL", "OTHER"];
  if (all.includes(exact)) return exact as AssetCategory;
  for (const [cat, re] of CATEGORY_WORDS) if (re.test(s)) return cat;
  return "OTHER";
}

export function parseAssetStatus(v: unknown): AssetStatus | null {
  const s = String(v ?? "").toLowerCase().trim();
  if (!s) return null;
  if (/stock|spare|available|free|unassigned|store/.test(s)) return "IN_STOCK";
  if (/assign|in use|issued|allocated|use|active/.test(s)) return "ASSIGNED";
  if (/repair|faulty|broken|service|damaged/.test(s)) return "UNDER_REPAIR";
  if (/retire|dispos|scrap|written|obsolete|e.?waste/.test(s)) return "RETIRED";
  if (/lost|stolen|missing/.test(s)) return "LOST_STOLEN";
  return null;
}

export function parseMoney(v: unknown): number | null | "invalid" {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/aed|dhs?|,|\s/gi, ""));
  return Number.isFinite(n) && n >= 0 ? n : "invalid";
}

const clean = (v: unknown, max = 200): string | null => {
  if (v === null || v === undefined) return null;
  const s = (v instanceof Date ? v.toISOString().slice(0, 10) : String(v)).replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};

// ─── row validation ─────────────────────────────────────────────────────

export type AssetRow = {
  assetTag: string | null; category: AssetCategory; make: string | null; model: string | null; serialNumber: string | null;
  purchaseDate: string | null; vendor: string | null; purchaseCost: number | null; invoiceRef: string | null;
  warrantyExpiry: string | null; branch: string | null; status: AssetStatus | null; ownerEmployeeId: string | null;
  ownerName: string | null; assignedDate: string | null; conditionNotes: string | null;
};

export type EmployeeRow = {
  employeeId: string; fullName: string; email: string | null; jobTitle: string | null; department: string | null;
  branch: string | null; lineManager: string | null; startDate: string | null; endDate: string | null; status: "ACTIVE" | "LEFT";
};

export type RowResult<T> = { line: number; data: T | null; errors: string[]; warnings: string[] };

function pick(raw: unknown[], mapping: Record<number, string>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [i, key] of Object.entries(mapping)) o[key] = raw[Number(i)];
  return o;
}

function dateField(o: Record<string, unknown>, key: string, label: string, errors: string[]) {
  const d = parseDate(o[key]);
  if (d === "invalid") { errors.push(`${label} “${o[key]}” is not a date (use dd/mm/yyyy)`); return null; }
  return d;
}

export function validateAssetRow(raw: unknown[], mapping: Record<number, string>, line: number): RowResult<AssetRow> {
  const o = pick(raw, mapping);
  const errors: string[] = [], warnings: string[] = [];
  const category = parseCategory(o.category);
  if (!category) errors.push("Category is empty");
  else if (category === "OTHER" && clean(o.category) && !/other/i.test(String(o.category))) warnings.push(`Category “${clean(o.category)}” not recognised – saved as Other`);
  const cost = parseMoney(o.purchaseCost);
  if (cost === "invalid") errors.push(`Cost “${o.purchaseCost}” is not a number`);
  const statusRaw = clean(o.status);
  const status = parseAssetStatus(o.status);
  if (statusRaw && !status) warnings.push(`Status “${statusRaw}” not recognised – status will be worked out from the owner`);
  const email = clean(o.ownerEmployeeId);
  const row: AssetRow = {
    assetTag: clean(o.assetTag, 50)?.toUpperCase() ?? null,
    category: category ?? "OTHER",
    make: clean(o.make), model: clean(o.model), serialNumber: clean(o.serialNumber, 100),
    purchaseDate: dateField(o, "purchaseDate", "Purchase date", errors),
    vendor: clean(o.vendor), purchaseCost: cost === "invalid" ? null : cost, invoiceRef: clean(o.invoiceRef),
    warrantyExpiry: dateField(o, "warrantyExpiry", "Warranty expiry", errors),
    branch: clean(o.branch), status, ownerEmployeeId: email, ownerName: clean(o.ownerName),
    assignedDate: dateField(o, "assignedDate", "Assigned date", errors),
    conditionNotes: clean(o.conditionNotes, 2000),
  };
  if (row.ownerName && !row.ownerEmployeeId) warnings.push(`Owner “${row.ownerName}” has no employee ID – will be matched by exact name`);
  return { line, data: errors.length ? null : row, errors, warnings };
}

export function validateEmployeeRow(raw: unknown[], mapping: Record<number, string>, line: number): RowResult<EmployeeRow> {
  const o = pick(raw, mapping);
  const errors: string[] = [], warnings: string[] = [];
  const employeeId = clean(o.employeeId, 50);
  const fullName = clean(o.fullName);
  if (!employeeId) errors.push("Employee ID is empty");
  if (!fullName) errors.push("Full name is empty");
  let email = clean(o.email)?.toLowerCase() ?? null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { warnings.push(`Email “${email}” looks wrong – skipped`); email = null; }
  const startDate = dateField(o, "startDate", "Start date", errors);
  const endDate = dateField(o, "endDate", "End date", errors);
  const st = String(o.status ?? "").toLowerCase();
  const status = /left|resign|terminat|inactive|exit|former|no\b/.test(st) || (endDate && endDate <= new Date().toISOString().slice(0, 10) && !st) ? "LEFT" : "ACTIVE";
  const row: EmployeeRow = {
    employeeId: employeeId ?? "", fullName: fullName ?? "", email,
    jobTitle: clean(o.jobTitle), department: clean(o.department), branch: clean(o.branch),
    lineManager: clean(o.lineManager), startDate, endDate, status,
  };
  return { line, data: errors.length ? null : row, errors, warnings };
}

/** Flags duplicate keys inside the file itself. */
export function markDuplicates<T>(results: RowResult<T>[], key: (d: T) => string | null, label: string) {
  const seen = new Map<string, number>();
  for (const r of results) {
    if (!r.data) continue;
    const k = key(r.data)?.toLowerCase();
    if (!k) continue;
    if (seen.has(k)) {
      r.errors.push(`${label} “${key(r.data)}” also appears on row ${seen.get(k)}`);
      r.data = null;
    } else seen.set(k, r.line);
  }
}
