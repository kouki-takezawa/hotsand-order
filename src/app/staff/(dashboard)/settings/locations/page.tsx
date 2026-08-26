import { listLocations } from "@/lib/data";
import { ErrorBanner } from "@/components/staff/ErrorBanner";
import { ConfirmButton } from "@/components/staff/ConfirmButton";
import { SubmitButton } from "@/components/staff/SubmitButton";
import { addLocationAction, renameLocationAction, deleteLocationAction } from "../actions";

export default async function LocationsSettingsPage(props: PageProps<"/staff/settings/locations">) {
  const { error } = await props.searchParams;
  const locations = await listLocations();

  return (
    <div className="max-w-lg">
      <ErrorBanner error={typeof error === "string" ? error : undefined} />

      <p className="mb-4 text-sm text-muted">
        QRコードを設置する提携店舗・拠点の一覧です。追加すると、QRコードタブでその拠点専用のQRコードが発行されます。そのQRから来た注文は「どこから注文されたか」として注文管理・分析画面に記録されます。
      </p>

      <div className="space-y-2">
        {locations.map((location) => (
          <form
            key={location.id}
            action={renameLocationAction}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface p-3"
          >
            <input type="hidden" name="id" value={location.id} />
            <input
              type="text"
              name="name"
              defaultValue={location.name}
              className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
            <SubmitButton className="rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground">
              保存
            </SubmitButton>
            <ConfirmButton
              confirmText={`「${location.name}」を削除しますか？`}
              formAction={deleteLocationAction}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-warning"
            >
              削除
            </ConfirmButton>
          </form>
        ))}
        {locations.length === 0 && <p className="text-xs text-muted">設置場所がまだ登録されていません</p>}
      </div>

      <form action={addLocationAction} className="mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-border bg-surface p-4">
        <input
          type="text"
          name="name"
          placeholder="設置場所の名前（例：渋谷店）"
          required
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
        <SubmitButton pendingText="追加中…" className="shrink-0 rounded-full bg-accent px-5 py-2 text-sm font-bold text-accent-foreground">
          設置場所を追加
        </SubmitButton>
      </form>
    </div>
  );
}
