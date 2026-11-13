import { Sidebar, type NavItem } from "@/components/Sidebar";
import { requireUser } from "@/lib/auth";
import { can, ROLE_LABELS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items: NavItem[] = [{ href: "/", label: "Dashboard", icon: "◧" }];
  if (can(user.role, "requests:view")) items.push({ href: "/requests", label: user.role === "HR" ? "My team's requests" : "HR requests", icon: "✉" });
  if (can(user.role, "assets:view")) items.push({ href: "/assets", label: "Assets", icon: "▣" });
  if (can(user.role, "employees:view")) items.push({ href: "/employees", label: "Employees", icon: "☺" });
  if (can(user.role, "import:run")) items.push({ href: "/import", label: "Import from Excel", icon: "⇪" });
  if (can(user.role, "audit:view")) items.push({ href: "/audit", label: "Audit log", icon: "☰" });
  if (can(user.role, "users:manage")) items.push({ href: "/admin/users", label: "Portal users", icon: "⚿" });
  if (can(user.role, "settings:manage")) items.push({ href: "/admin/branches", label: "Branches", icon: "⌂" });

  return (
    <div className="min-h-screen">
      <Sidebar items={items} user={user} roleLabel={ROLE_LABELS[user.role]} />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
