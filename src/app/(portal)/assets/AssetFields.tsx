import type { Asset, Branch } from "@prisma/client";
import { CATEGORY_LABELS } from "@/lib/labels";
import { isoDate } from "@/lib/format";

export function AssetFields({ asset, branches }: { asset?: Asset | null; branches: Branch[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <label className="label" htmlFor="category">Category *</label>
        <select id="category" name="category" required defaultValue={asset?.category ?? ""} className="input">
          <option value="" disabled>Choose…</option>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <Input name="make" label="Make" value={asset?.make} placeholder="Dell" />
      <Input name="model" label="Model" value={asset?.model} placeholder="Latitude 5440" />
      <Input name="serialNumber" label="Serial number" value={asset?.serialNumber} />
      <div>
        <label className="label" htmlFor="branchId">Branch / location</label>
        <select id="branchId" name="branchId" defaultValue={asset?.branchId ?? ""} className="input">
          <option value="">—</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <Input name="vendor" label="Vendor" value={asset?.vendor} />
      <Input name="purchaseDate" label="Purchase date" type="date" value={isoDate(asset?.purchaseDate ?? null)} />
      <Input name="purchaseCost" label="Purchase cost (AED)" value={asset?.purchaseCost?.toString()} inputMode="decimal" />
      <Input name="invoiceRef" label="Invoice reference" value={asset?.invoiceRef} />
      <Input name="warrantyExpiry" label="Warranty expiry" type="date" value={isoDate(asset?.warrantyExpiry ?? null)} />
      <div className="sm:col-span-2">
        <label className="label" htmlFor="conditionNotes">Condition notes</label>
        <textarea id="conditionNotes" name="conditionNotes" rows={2} defaultValue={asset?.conditionNotes ?? ""} className="input" />
      </div>
    </div>
  );
}

function Input({ name, label, value, ...rest }: { name: string; label: string; value?: string | null } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value">) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} defaultValue={value ?? ""} className="input" {...rest} />
    </div>
  );
}
