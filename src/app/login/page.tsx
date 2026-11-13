import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { getCurrentUser } from "@/lib/auth";
import { CodeForm, EmailForm } from "./LoginForms";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { step } = await searchParams;
  if (step === "code") {
    return (
      <AuthShell title="Check your email">
        <p className="mb-4 text-sm text-slate-600">
          If that address has portal access, we've emailed it a 6-digit code. It expires in 10 minutes.
        </p>
        <CodeForm />
        <p className="mt-4 text-center text-sm"><Link className="link" href="/login">Use a different email</Link></p>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Sign in with your clinic email">
      <EmailForm />
      <p className="mt-4 text-center text-xs text-slate-500">No password needed. Access is set up by the IT Admin.</p>
    </AuthShell>
  );
}
