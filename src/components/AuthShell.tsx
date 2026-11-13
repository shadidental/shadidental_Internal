import Image from "next/image";
import { config } from "@/lib/config";

export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-teal-light via-white to-brand-plum-light p-4">
      <div className="w-full max-w-md">
        <div className="card overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-brand-teal to-brand-plum" />
          <div className="p-8">
            <Image src="/logo.png" alt={config.orgName} width={220} height={114} className="mx-auto mb-4 h-auto w-48" priority />
            <h1 className="mb-1 text-center text-lg font-semibold text-brand-plum">IT Portal</h1>
            <p className="mb-6 text-center text-sm text-slate-500">{title}</p>
            {children}
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">Authorised {config.orgShort} staff only. All activity is logged.</p>
      </div>
    </main>
  );
}
