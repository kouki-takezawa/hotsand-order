"use client";

import { useFormStatus } from "react-dom";

// フォーム内のステータス切り替えピル群。押した瞬間に見た目が変わらないと
// 反応していないように感じられるため、送信中は薄く・操作不可にする。
export function StatusPillGroup({
  id,
  options,
  current,
  formAction,
}: {
  id: string;
  options: { value: string; label: string }[];
  current: string;
  formAction: (formData: FormData) => void;
}) {
  const { pending } = useFormStatus();
  return (
    <div className={`flex flex-wrap gap-1.5 ${pending ? "opacity-50" : ""}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="submit"
          formAction={formAction}
          name="status"
          value={option.value}
          formNoValidate
          disabled={pending}
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            current === option.value ? "bg-accent text-accent-foreground" : "border border-border text-muted"
          }`}
        >
          {option.label}
        </button>
      ))}
      <input type="hidden" name="id" value={id} />
    </div>
  );
}
