import { getTables } from "@/lib/data";
import { ErrorBanner } from "@/components/staff/ErrorBanner";
import { ConfirmButton } from "@/components/staff/ConfirmButton";
import { SubmitButton } from "@/components/staff/SubmitButton";
import { addTableAction, renameTableAction, deleteTableAction } from "../actions";

export default async function TablesSettingsPage(props: PageProps<"/staff/settings/tables">) {
  const { error } = await props.searchParams;
  const tables = await getTables();

  return (
    <div className="max-w-lg">
      <ErrorBanner error={typeof error === "string" ? error : undefined} />

      <div className="space-y-2">
        {tables.map((table) => (
          <form
            key={table.id}
            action={renameTableAction}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface p-3"
          >
            <input type="hidden" name="id" value={table.id} />
            <span className="w-12 shrink-0 text-sm text-muted">卓{table.number}</span>
            <input
              type="text"
              name="name"
              defaultValue={table.name ?? ""}
              className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
            <SubmitButton className="rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground">
              保存
            </SubmitButton>
            <ConfirmButton
              confirmText={`卓${table.number}を削除しますか？`}
              formAction={deleteTableAction}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-warning"
            >
              削除
            </ConfirmButton>
          </form>
        ))}
      </div>

      <form action={addTableAction} className="mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-border bg-surface p-4">
        <input
          type="text"
          name="name"
          placeholder="卓の表示名（空欄なら「卓N」）"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
        <SubmitButton pendingText="追加中…" className="shrink-0 rounded-full bg-accent px-5 py-2 text-sm font-bold text-accent-foreground">
          卓を追加
        </SubmitButton>
      </form>
    </div>
  );
}
