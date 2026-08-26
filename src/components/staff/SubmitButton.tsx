"use client";

import { useFormStatus } from "react-dom";

// フォーム送信中であることを即座に見せるためのボタン。サーバーアクションの
// 往復を待つあいだ何も見た目が変わらないと「反応していない」ように感じられる
// ため、useFormStatusでpending状態を検知してすぐに視覚的フィードバックを出す。
export function SubmitButton({
  children,
  pendingText,
  className,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className ?? ""} disabled:opacity-50`}>
      {pending ? (pendingText ?? "処理中…") : children}
    </button>
  );
}
