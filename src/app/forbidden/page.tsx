import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";

export default function Forbidden() {
  return (
    <AuthShell title="You don't have access to that page">
      <p className="mb-4 text-center text-sm text-slate-600">Your role doesn't include this area. Ask the IT Admin if you need access.</p>
      <Link href="/" className="btn-primary w-full">Back to the portal</Link>
    </AuthShell>
  );
}
