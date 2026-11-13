import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { getPendingSession } from "@/lib/auth";
import { MfaForm } from "../LoginForms";

export const metadata = { title: "Two-step verification" };

export default async function MfaPage() {
  const s = await getPendingSession();
  if (!s) redirect("/login");
  if (s.mfaPassed) redirect("/");
  if (!s.user.totpEnabled) redirect("/login/mfa/setup");
  return (
    <AuthShell title={`Two-step verification for ${s.user.email}`}>
      <MfaForm />
      <p className="mt-4 text-center text-xs text-slate-500">Lost your phone? Ask the IT Admin to reset your two-step verification.</p>
    </AuthShell>
  );
}
