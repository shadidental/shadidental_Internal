import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { AuthShell } from "@/components/AuthShell";
import { getPendingSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { totpUri } from "@/lib/crypto";
import { ensureSetupSecret } from "../../actions";
import { MfaSetupForm } from "../../LoginForms";

export const metadata = { title: "Set up two-step verification" };

export default async function MfaSetupPage() {
  const s = await getPendingSession();
  if (!s) redirect("/login");
  if (s.mfaPassed) redirect("/");
  if (s.user.totpEnabled) redirect("/login/mfa");
  const setup = await ensureSetupSecret();
  if (!setup) redirect("/login");
  const qr = await QRCode.toDataURL(totpUri(setup.secret, setup.email, `${config.orgShort} IT Portal`), { margin: 1, width: 200 });
  return (
    <AuthShell title="Set up two-step verification">
      <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>Open Microsoft Authenticator, Google Authenticator or a similar app on your phone.</li>
        <li>Add an account and scan this QR code.</li>
        <li>Type the 6-digit code it shows below.</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="QR code for authenticator app" className="mx-auto mb-2 rounded border border-slate-200" width={200} height={200} />
      <details className="mb-4 text-center text-xs text-slate-500">
        <summary className="cursor-pointer">Can't scan? Enter this key instead</summary>
        <code className="mt-2 block break-all rounded bg-slate-100 p-2 font-mono text-slate-700">{setup.secret.match(/.{1,4}/g)?.join(" ")}</code>
      </details>
      <MfaSetupForm />
    </AuthShell>
  );
}
