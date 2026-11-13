import type { AuditLog } from "@prisma/client";
import { fmtDateTime } from "@/lib/format";

export function HistoryList({ entries }: { entries: AuditLog[] }) {
  if (!entries.length) return <p className="text-sm text-slate-500">No history yet.</p>;
  return (
    <ol className="relative space-y-3 border-l-2 border-brand-teal-light pl-4">
      {entries.map((e) => (
        <li key={e.id.toString()} className="text-sm">
          <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-brand-teal" />
          <p>{e.summary}</p>
          <p className="text-xs text-slate-500">{fmtDateTime(e.at)} · {e.actorEmail ?? "system"} · {e.action}</p>
        </li>
      ))}
    </ol>
  );
}
