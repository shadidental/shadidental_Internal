export type FormState = { error?: string; ok?: string } | undefined;

export function FormMessage({ state }: { state: FormState }) {
  if (!state) return null;
  if (state.error) return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{state.error}</p>;
  if (state.ok) return <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">{state.ok}</p>;
  return null;
}
