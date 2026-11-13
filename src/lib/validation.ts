import { z } from "zod";

/** Empty strings from forms become null. */
export const optText = (max = 200) =>
  z.preprocess((v) => (v == null || (typeof v === "string" && v.trim() === "") ? null : typeof v === "string" ? v.trim() : v), z.string().max(max, `Keep it under ${max} characters`).nullable());

export const reqText = (label: string, max = 200) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string({ error: `${label} is required` }).min(1, `${label} is required`).max(max));

/** yyyy-mm-dd → Date at UTC midnight, or null. */
export const optDate = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "invalid";
  return new Date(s + "T00:00:00Z");
}, z.date({ error: "Use a valid date" }).nullable());

export const reqDate = (label: string) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : new Date(String(v) + "T00:00:00Z")), z.date({ error: `${label} is required` }));

export const optMoney = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : "invalid";
}, z.number({ error: "Cost must be a number" }).min(0).nullable());

export const optEmail = z.preprocess(
  (v) => (v == null || (typeof v === "string" && v.trim() === "") ? null : typeof v === "string" ? v.trim().toLowerCase() : v),
  z.email("Enter a valid email").nullable(),
);

export function formObject(form: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && !k.startsWith("$")) o[k] = v;
  return o;
}

export function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Please check the form";
}
