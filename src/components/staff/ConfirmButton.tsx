"use client";

import { useFormStatus } from "react-dom";

export function ConfirmButton({
  confirmText,
  className,
  formAction,
  children,
}: {
  confirmText: string;
  className?: string;
  formAction?: (formData: FormData) => void;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={pending}
      className={`${className ?? ""} disabled:opacity-50`}
      onClick={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      {pending ? "処理中…" : children}
    </button>
  );
}
