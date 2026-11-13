"use client";
import { useActionState } from "react";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { confirmMfaSetup, requestCode, verifyCode, verifyMfa } from "./actions";

export function EmailForm() {
  const [state, action] = useActionState(requestCode, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Work email</label>
        <input id="email" name="email" type="email" required autoFocus autoComplete="email" className="input" placeholder="name@clinic.ae" />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Sending code…">Email me a sign-in code</SubmitButton>
    </form>
  );
}

function CodeInput({ name = "code" }: { name?: string }) {
  return (
    <input
      id={name} name={name} inputMode="numeric" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus
      autoComplete="one-time-code" className="input text-center text-2xl tracking-[0.5em]" placeholder="••••••"
    />
  );
}

export function CodeForm() {
  const [state, action] = useActionState(verifyCode, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="code">6-digit code from your email</label>
        <CodeInput />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Checking…">Continue</SubmitButton>
    </form>
  );
}

export function MfaForm() {
  const [state, action] = useActionState(verifyMfa, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="code">Code from your authenticator app</label>
        <CodeInput />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Checking…">Verify</SubmitButton>
    </form>
  );
}

export function MfaSetupForm() {
  const [state, action] = useActionState(confirmMfaSetup, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="code">Enter the 6-digit code the app shows</label>
        <CodeInput />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Checking…">Turn on two-step verification</SubmitButton>
    </form>
  );
}
