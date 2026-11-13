"use client";
import { useActionState, useState } from "react";
import type { HrRequestType } from "@prisma/client";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { REQUEST_TYPE_DATE_LABEL, REQUEST_TYPE_LABELS } from "@/lib/labels";
import { createRequest } from "../actions";

type Emp = { id: string; fullName: string; employeeId: string; department: string | null };

const HINTS: Record<HrRequestType, string> = {
  JOINER: "List the systems and equipment the new joiner needs (email, practice software, laptop, phone…).",
  LEAVER: "Anything IT should know: data to keep, mailbox forwarding, equipment to collect.",
  ASSET_ALLOCATION: "Which equipment is needed and why.",
  ASSET_RETURN: "Which equipment should be collected.",
};

export function RequestForm({ employees, branches }: { employees: Emp[]; branches: string[] }) {
  const [state, action] = useActionState(createRequest, undefined);
  const [type, setType] = useState<HrRequestType>("JOINER");
  return (
    <form action={action} className="space-y-6">
      <fieldset>
        <legend className="label mb-2">What do you need?</legend>
        <div className="grid gap-2 sm:grid-cols-4">
          {(Object.keys(REQUEST_TYPE_LABELS) as HrRequestType[]).map((t) => (
            <label key={t} className={`cursor-pointer rounded-lg border-2 px-3 py-3 text-sm font-medium ${type === t ? "border-brand-plum bg-brand-plum-light text-brand-plum" : "border-slate-200 hover:border-brand-teal"}`}>
              <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
              {REQUEST_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
      </fieldset>

      {type === "JOINER" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <F name="employeeName" label="Full name *" required />
          <F name="employeeNumber" label="Employee ID" />
          <F name="jobTitle" label="Job title" />
          <F name="department" label="Department" />
          <div>
            <label className="label" htmlFor="branchName">Branch</label>
            <select id="branchName" name="branchName" className="input" defaultValue="">
              <option value="">—</option>
              {branches.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
          <F name="lineManager" label="Line manager" />
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="employeeRef">Employee *</label>
          <select id="employeeRef" name="employeeRef" required className="input" defaultValue="">
            <option value="" disabled>Choose…</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName} ({e.employeeId}){e.department ? ` – ${e.department}` : ""}</option>)}
          </select>
          <p className="mt-1 text-xs text-slate-500">Not in the list? Ask IT to add them, or raise a New joiner request.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <F name="effectiveDate" label={`${REQUEST_TYPE_DATE_LABEL[type]}${type === "JOINER" || type === "LEAVER" ? " *" : ""}`} type="date" required={type === "JOINER" || type === "LEAVER"} />
      </div>
      <div>
        <label className="label" htmlFor="details">Details / requirements</label>
        <textarea id="details" name="details" rows={5} className="input" placeholder={HINTS[type]} />
        <p className="mt-1 text-xs text-slate-500">Never include passwords.</p>
      </div>

      <div className="rounded-md border border-brand-teal/30 bg-brand-teal-light px-4 py-3 text-sm text-brand-teal-dark">
        When you submit, the portal emails the IT team with you in copy. That email is stored in the portal as the official record of this request.
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Submitting and emailing IT…">Submit request to IT</SubmitButton>
    </form>
  );
}

function F({ name, label, ...rest }: { name: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} className="input" {...rest} />
    </div>
  );
}
