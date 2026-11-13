"use client";
import { useActionState, useEffect, useRef } from "react";
import { FormMessage, type FormState } from "./FormMessage";
import { SubmitButton } from "./SubmitButton";

/** A form bound to a server action, showing its error/success message. */
export function ActionForm({
  action, children, submitLabel, submitClass = "btn-primary", pendingText, confirm, className = "space-y-4", resetOnSuccess = false,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submitLabel: string;
  submitClass?: string;
  pendingText?: string;
  confirm?: string;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state?.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <FormMessage state={state} />
      <div>
        <SubmitButton className={submitClass} pendingText={pendingText} confirm={confirm}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
