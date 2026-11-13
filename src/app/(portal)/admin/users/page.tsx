import { ActionForm } from "@/components/ActionForm";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";
import { fmtDateTime } from "@/lib/format";
import { addUser, resetMfa, setUserActive, updateUser } from "./actions";

export const metadata = { title: "Portal users" };

export default async function UsersPage() {
  const me = await requireUser("users:manage");
  const users = await db.portalUser.findMany({ orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }] });
  const roleOptions = Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>);
  return (
    <>
      <PageHeader title="Portal users" subtitle="Only people listed here can sign in. HR and IT see different parts of the portal." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <div className="-mx-4 overflow-x-auto">
              <table className="table">
                <thead><tr><th>Name / email</th><th>Role</th><th>2-step</th><th>Last sign-in</th><th></th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className={u.active ? "" : "opacity-60"}>
                      <td>
                        <ActionForm action={updateUser.bind(null, u.id)} submitLabel="Save" submitClass="btn-outline !px-2 !py-1 text-xs" className="flex flex-wrap items-center gap-2">
                          <div className="min-w-48">
                            <input name="name" defaultValue={u.name} className="input !py-1" aria-label="Name" />
                            <p className="mt-0.5 text-xs text-slate-500">{u.email}</p>
                          </div>
                          <select name="role" defaultValue={u.role} className="input !w-auto !py-1" aria-label="Role">{roleOptions}</select>
                        </ActionForm>
                      </td>
                      <td>{!u.active && <Badge className="bg-slate-200 text-slate-600">Removed</Badge>}</td>
                      <td>{u.totpEnabled ? <Badge className="bg-emerald-100 text-emerald-800">On</Badge> : <Badge className="bg-amber-100 text-amber-800">Not set up</Badge>}</td>
                      <td className="whitespace-nowrap text-xs">{fmtDateTime(u.lastLoginAt)}</td>
                      <td className="space-y-1">
                        {u.id !== me.id && (
                          <ActionForm action={async () => { "use server"; return setUserActive(u.id, !u.active); }} submitLabel={u.active ? "Remove access" : "Restore access"} submitClass={u.active ? "btn-danger !px-2 !py-1 text-xs" : "btn-teal !px-2 !py-1 text-xs"} confirm={u.active ? `Remove ${u.email}'s access? They are signed out immediately.` : undefined} className="space-y-1">
                            <span />
                          </ActionForm>
                        )}
                        {u.totpEnabled && (
                          <ActionForm action={async () => { "use server"; return resetMfa(u.id); }} submitLabel="Reset 2-step" submitClass="btn-outline !px-2 !py-1 text-xs" confirm={`Reset two-step verification for ${u.email}? Only do this after confirming who is asking.`} className="space-y-1">
                            <span />
                          </ActionForm>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Add a user">
            <ActionForm action={addUser} submitLabel="Give access" resetOnSuccess>
              <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" required className="input" /></div>
              <div><label className="label" htmlFor="email">Clinic email</label><input id="email" name="email" type="email" required className="input" /></div>
              <div><label className="label" htmlFor="role">Role</label><select id="role" name="role" required className="input" defaultValue="">{[<option key="" value="" disabled>Choose…</option>, ...roleOptions]}</select></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify" defaultChecked /> Email them how to sign in</label>
            </ActionForm>
          </Card>
          <Card title="Roles">
            <dl className="space-y-2 text-sm">
              {Object.entries(ROLE_DESCRIPTIONS).map(([r, d]) => (
                <div key={r}><dt className="font-semibold text-brand-plum">{ROLE_LABELS[r as keyof typeof ROLE_LABELS]}</dt><dd className="text-slate-600">{d}</dd></div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
