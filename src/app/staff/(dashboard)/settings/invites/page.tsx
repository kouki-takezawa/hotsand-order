import { headers } from "next/headers";
import { listStaffInvites } from "@/lib/data";
import { getBaseUrl } from "@/lib/url";
import { formatDate } from "@/lib/format";
import { ConfirmButton } from "@/components/staff/ConfirmButton";
import { SubmitButton } from "@/components/staff/SubmitButton";
import { createInviteAction, deleteInviteAction } from "../actions";

// ベースURL（招待リンクの組み立て）はリクエストヘッダーに依存するため
// 静的プリレンダーを禁止する
export const dynamic = "force-dynamic";

export default async function InvitesSettingsPage() {
  const [invites, headerList] = await Promise.all([listStaffInvites(), headers()]);
  const baseUrl = getBaseUrl(headerList);
  // eslint-disable-next-line react-hooks/purity -- Server Componentはリクエストごとに1回しか実行されず、クライアント側の再レンダリング前提の純粋性ルールは当てはまらない
  const now = Date.now();

  return (
    <div className="max-w-2xl">
      <p className="mb-4 text-sm text-muted">
        新規登録には招待コードが必須です。ここで発行したコード（またはリンク）を、新しく入るスタッフに直接伝えてください。コードは1回使うと失効します。
      </p>

      <div className="space-y-3">
        {invites.length === 0 && <p className="text-sm text-muted">発行済みの招待コードはありません</p>}
        {invites.map((invite) => {
          const expired = invite.expiresAt ? invite.expiresAt.getTime() < now : false;
          const status = invite.usedAt ? "used" : expired ? "expired" : "active";
          return (
            <div key={invite.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-lg font-bold tracking-widest text-foreground">{invite.code}</p>
                  {invite.note && <p className="text-xs text-muted">{invite.note}</p>}
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    status === "active"
                      ? "bg-accent text-accent-foreground"
                      : "border border-border text-muted"
                  }`}
                >
                  {status === "active" ? "未使用" : status === "used" ? `使用済み（${invite.usedByEmail}）` : "期限切れ"}
                </span>
              </div>
              <p className="mb-2 break-all text-xs text-muted">
                {baseUrl}/staff/login?invite={invite.code}
              </p>
              <div className="flex items-center justify-between text-xs text-muted">
                <span>
                  発行日: {formatDate(invite.createdAt)}
                  {invite.expiresAt && ` ／ 期限: ${formatDate(invite.expiresAt)}`}
                </span>
                {status === "active" && (
                  <form action={deleteInviteAction}>
                    <input type="hidden" name="id" value={invite.id} />
                    <ConfirmButton confirmText="この招待コードを無効化しますか？" className="text-warning underline underline-offset-4">
                      無効化
                    </ConfirmButton>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <form action={createInviteAction} className="mt-6 space-y-3 rounded-2xl border border-dashed border-border bg-surface p-4">
        <p className="text-sm font-bold text-foreground">招待コードを発行</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            type="text"
            name="note"
            placeholder="メモ（例: 新人の田中さん用、任意）"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          <input
            type="number"
            name="expiresInDays"
            min={1}
            placeholder="有効期限（日数・任意）"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <SubmitButton pendingText="発行中…" className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-accent-foreground">
          コードを発行する
        </SubmitButton>
      </form>
    </div>
  );
}
