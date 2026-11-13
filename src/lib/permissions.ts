import type { Role } from "@prisma/client";

/** What each role can do. Kept in one place so it is easy to review. */
const MATRIX = {
  "assets:view": ["ADMIN", "IT_STAFF", "READ_ONLY"],
  "assets:edit": ["ADMIN", "IT_STAFF"],
  "assets:delete": ["ADMIN"],
  "employees:view": ["ADMIN", "IT_STAFF", "READ_ONLY"],
  "employees:edit": ["ADMIN", "IT_STAFF"],
  "employees:delete": ["ADMIN"],
  "employees:lookup": ["ADMIN", "IT_STAFF", "HR"], // pick an employee on a request form
  "requests:view": ["ADMIN", "IT_STAFF", "HR", "READ_ONLY"],
  "requests:create": ["ADMIN", "IT_STAFF", "HR"],
  "requests:comment": ["ADMIN", "IT_STAFF", "HR"],
  "requests:work": ["ADMIN", "IT_STAFF"], // assign, progress, complete
  "import:run": ["ADMIN", "IT_STAFF"],
  "audit:view": ["ADMIN", "IT_STAFF", "READ_ONLY"],
  "audit:export": ["ADMIN", "READ_ONLY"],
  "users:manage": ["ADMIN"],
  "settings:manage": ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof MATRIX;

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return (MATRIX[permission] as readonly Role[]).includes(role);
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "IT Admin",
  IT_STAFF: "IT Staff",
  HR: "HR",
  READ_ONLY: "Read-only",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "Everything, including adding and removing portal users and deleting records.",
  IT_STAFF: "Assets, employees, accounts, imports, and working on HR requests.",
  HR: "Raise joiner, leaver and asset requests, and follow their progress.",
  READ_ONLY: "View assets, employees, requests and the audit log (management / auditors).",
};
