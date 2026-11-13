import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";

export default function NotFound() {
  return (
    <AuthShell title="Page not found">
      <Link href="/" className="btn-primary w-full">Back to the portal</Link>
    </AuthShell>
  );
}
