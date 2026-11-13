"use client";
import { startTransition, useActionState, useState } from "react";
import Link from "next/link";
import { FormMessage } from "@/components/FormMessage";
import { fieldsFor, type ImportKind } from "@/lib/import";
import { commitImport, previewImport } from "./actions";

export function ImportClient() {
  const [kind, setKind] = useState<ImportKind>("employees");
  const [preview, previewAction, previewing] = useActionState(previewImport, undefined);
  const [result, commitAction, committing] = useActionState(commitImport, undefined);
  const [file, setFile] = useState<File | null>(null);
  // Actions are dispatched by hand (not via <form action>) so React doesn't
  // reset the form and drop the chosen file between "Check" and "Import".
  const run = (fn: (fd: FormData) => void) => {
    if (!file) return;
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("file", file);
    startTransition(() => fn(fd));
  };
  const p = preview && preview.kind === kind ? preview : undefined;
  const ok = p?.results.filter((r) => r.data).length ?? 0;
  const bad = (p?.results.length ?? 0) - ok;
  const warn = p?.results.filter((r) => r.data && r.warnings.length).length ?? 0;

  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); run(previewAction); }}>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="kind">What are you importing?</label>
          <select id="kind" name="kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as ImportKind)}>
            <option value="employees">Employees (do this first)</option>
            <option value="assets">Assets</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="file">Excel (.xlsx) or CSV file</label>
          <input id="file" name="file" type="file" accept=".xlsx,.csv" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="input file:mr-3 file:rounded file:border-0 file:bg-brand-teal-light file:px-3 file:py-1 file:text-brand-teal-dark" />
        </div>
      </div>

      <details className="text-sm text-slate-600">
        <summary className="cursor-pointer font-medium text-brand-plum">Which columns are recognised?</summary>
        <p className="mt-2">Column names don't need to match exactly; common names are recognised. Dates can be dd/mm/yyyy, yyyy-mm-dd or Excel dates.</p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {fieldsFor(kind).map((f) => (
            <li key={f.key}><b>{f.label}{f.required ? " *" : ""}</b>: <span className="text-slate-500">{f.aliases.slice(0, 4).join(", ")}…</span></li>
          ))}
        </ul>
      </details>

      <button type="submit" className="btn-teal" disabled={!file || previewing}>{previewing ? "Reading file…" : "Check file"}</button>

      {p?.error && <FormMessage state={{ error: p.error }} />}
      {p && !p.error && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Rows read" value={p.results.length} />
            <Stat label="Ready to import" value={ok} tone="good" />
            <Stat label="With warnings" value={warn} tone="warn" />
            <Stat label="With errors (skipped)" value={bad} tone="bad" />
          </div>
          <div className="text-sm">
            <p><b>Columns matched:</b> {Object.entries(p.mapping).map(([i, k]) => `${p.headers[Number(i)]} → ${fieldsFor(p.kind).find((f) => f.key === k)?.label}`).join(" · ") || "none"}</p>
            {p.unmapped.length > 0 && <p className="text-slate-500"><b>Ignored columns:</b> {p.unmapped.join(", ")}</p>}
          </div>
          <div className="max-h-96 overflow-auto rounded border border-slate-200">
            <table className="table">
              <thead className="sticky top-0"><tr><th>Row</th><th>Record</th><th>Problems</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {p.results.filter((r) => r.errors.length || r.warnings.length).slice(0, 300).map((r) => (
                  <tr key={r.line}>
                    <td>{r.line}</td>
                    <td className="text-xs">{r.data ? summary(r.data as Record<string, unknown>) : "—"}</td>
                    <td className="text-xs">
                      {r.errors.map((e, i) => <p key={i} className="text-red-700">✕ {e}</p>)}
                      {r.warnings.map((w, i) => <p key={i} className="text-amber-700">! {w}</p>)}
                    </td>
                  </tr>
                ))}
                {p.results.every((r) => !r.errors.length && !r.warnings.length) && <tr><td colSpan={3} className="text-center text-emerald-700">No problems found.</td></tr>}
              </tbody>
            </table>
          </div>
          {ok > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button" className="btn-primary" disabled={committing || !!result?.ok}
                onClick={() => { if (window.confirm(`Import ${ok} ${p.kind}? Every record is logged.`)) run(commitAction); }}
              >
                {committing ? "Importing…" : `Import ${ok} ${p.kind}`}
              </button>
              <span className="text-xs text-slate-500">Rows with errors are skipped. Fix them in the file and import again later.</span>
            </div>
          )}
        </div>
      )}
      <FormMessage state={result} />
      {result?.ok && <p className="text-sm"><Link className="link" href={`/${kind}`}>View {kind} →</Link></p>}
    </form>
  );
}

function summary(d: Record<string, unknown>) {
  return ["employeeId", "fullName", "assetTag", "category", "make", "model", "serialNumber", "ownerEmployeeId", "ownerName"]
    .map((k) => d[k]).filter(Boolean).join(" · ");
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "good" | "warn" | "bad" }) {
  const c = tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : tone === "bad" ? "text-red-700" : "text-slate-800";
  return <div className="rounded border border-slate-200 p-3"><p className="text-xs uppercase text-slate-500">{label}</p><p className={`text-2xl font-semibold ${c}`}>{value}</p></div>;
}
