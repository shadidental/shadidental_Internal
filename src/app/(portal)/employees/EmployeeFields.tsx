import type { Branch, Employee } from "@prisma/client";
import { isoDate } from "@/lib/format";

export function EmployeeFields({ e, branches }: { e?: Employee | null; branches: Branch[] }) {
  const I = ({ name, label, value, ...rest }: { name: string; label: string; value?: string | null } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value">) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} defaultValue={value ?? ""} className="input" {...rest} />
    </div>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <I name="employeeId" label="Employee ID *" value={e?.employeeId} required />
      <I name="fullName" label="Full name *" value={e?.fullName} required />
      <I name="email" label="Work email" type="email" value={e?.email} />
      <I name="jobTitle" label="Job title" value={e?.jobTitle} />
      <I name="department" label="Department" value={e?.department} />
      <div>
        <label className="label" htmlFor="branchId">Branch</label>
        <select id="branchId" name="branchId" defaultValue={e?.branchId ?? ""} className="input">
          <option value="">—</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <I name="lineManager" label="Line manager" value={e?.lineManager} />
      <I name="startDate" label="Start date" type="date" value={isoDate(e?.startDate ?? null)} />
      <I name="endDate" label="End date" type="date" value={isoDate(e?.endDate ?? null)} />
    </div>
  );
}
