import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { Card, PageHeader } from "@/components/ui";
import type { FormState } from "@/components/FormMessage";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

export const metadata = { title: "Branches" };

async function addBranch(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const user = await requireUser("settings:manage");
  const name = String(form.get("name") || "").trim();
  const code = String(form.get("code") || "").trim().toUpperCase();
  if (!name || !/^[A-Z0-9]{2,10}$/.test(code)) return { error: "Enter a name and a 2–10 character code (letters/numbers)." };
  try {
    const b = await db.branch.create({ data: { name, code } });
    await audit({ actor: user, action: "CREATE", entityType: "Branch", entityId: b.id, summary: `Added branch ${name} (${code})` });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "That name or code already exists." };
    throw e;
  }
  revalidatePath("/admin/branches");
  return { ok: `Added ${name}.` };
}

async function toggleBranch(id: string): Promise<FormState> {
  "use server";
  const user = await requireUser("settings:manage");
  const b = await db.branch.findUniqueOrThrow({ where: { id } });
  await db.branch.update({ where: { id }, data: { active: !b.active } });
  await audit({ actor: user, action: "UPDATE", entityType: "Branch", entityId: id, summary: `${b.active ? "Archived" : "Restored"} branch ${b.name}` });
  revalidatePath("/admin/branches");
  return { ok: "Saved." };
}

export default async function BranchesPage() {
  await requireUser("settings:manage");
  const branches = await db.branch.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { assets: true, employees: true } } } });
  return (
    <>
      <PageHeader title="Branches" subtitle="Clinic locations used for assets and employees." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <table className="table">
            <thead><tr><th>Name</th><th>Code</th><th>Assets</th><th>Employees</th><th></th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {branches.map((b) => (
                <tr key={b.id} className={b.active ? "" : "opacity-60"}>
                  <td>{b.name}</td><td className="font-mono">{b.code}</td><td>{b._count.assets}</td><td>{b._count.employees}</td>
                  <td>
                    <ActionForm action={async () => { "use server"; return toggleBranch(b.id); }} submitLabel={b.active ? "Archive" : "Restore"} submitClass="btn-outline !px-2 !py-1 text-xs" className="">
                      <span />
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Add branch">
          <ActionForm action={addBranch} submitLabel="Add branch" resetOnSuccess>
            <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" className="input" placeholder="Khalifa City" required /></div>
            <div><label className="label" htmlFor="code">Short code</label><input id="code" name="code" className="input" placeholder="KC" required /></div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
