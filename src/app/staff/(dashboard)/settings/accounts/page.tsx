import { listStaffAccounts } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { ErrorBanner } from "@/components/staff/ErrorBanner";
import { ConfirmButton } from "@/components/staff/ConfirmButton";
import { SubmitButton } from "@/components/staff/SubmitButton";
import { addAccountAction, deleteAccountAction, resetPasswordAction } from "../actions";

export default async function AccountsSettingsPage(props: PageProps<"/staff/settings/accounts">) {
  const { error } = await props.searchParams;
  const accounts = await listStaffAccounts();

  return (
    <div className="max-w-2xl">
      <ErrorBanner error={typeof error === "string" ? error : undefined} />

      <div className="space-y-3">
        {accounts.map((account) => (
          <div key={account.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">{account.name}</p>
                <p className="text-xs text-muted">{account.email}</p>
                <p className="text-[10px] text-muted">作成日: {formatDate(account.createdAt)}</p>
              </div>
              <form action={deleteAccountAction}>
                <input type="hidden" name="id" value={account.id} />
                <ConfirmButton
                  confirmText={`「${account.name}」（${account.email}）を削除しますか？`}
                  className="text-xs text-warning underline underline-offset-4"
                >
                  削除
                </ConfirmButton>
              </form>
            </div>
            <form action={resetPasswordAction} className="flex items-center gap-2">
              <input type="hidden" name="id" value={account.id} />
              <input
                type="password"
                name="password"
                placeholder="新しいパスワード（8文字以上）"
                minLength={8}
                className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground"
              />
              <SubmitButton pendingText="再設定中…" className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-foreground">
                パスワードを再設定
              </SubmitButton>
            </form>
          </div>
        ))}
      </div>

      <form action={addAccountAction} className="mt-6 space-y-3 rounded-2xl border border-dashed border-border bg-surface p-4">
        <p className="text-sm font-bold text-foreground">アカウントを追加</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            type="text"
            name="name"
            placeholder="名前"
            required
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          <input
            type="email"
            name="email"
            placeholder="メールアドレス"
            required
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          <input
            type="password"
            name="password"
            placeholder="パスワード（8文字以上）"
            minLength={8}
            required
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <SubmitButton pendingText="追加中…" className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-accent-foreground">
          追加する
        </SubmitButton>
      </form>
    </div>
  );
}
