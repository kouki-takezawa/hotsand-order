import { getSettings } from "@/lib/data";
import { ErrorBanner } from "@/components/staff/ErrorBanner";
import { SubmitButton } from "@/components/staff/SubmitButton";
import { updateGeneralSettingsAction } from "../actions";

export default async function GeneralSettingsPage(props: PageProps<"/staff/settings/general">) {
  const { error } = await props.searchParams;
  const settings = await getSettings();

  return (
    <div className="max-w-lg">
      <ErrorBanner error={typeof error === "string" ? error : undefined} />

      <form action={updateGeneralSettingsAction} className="space-y-6 rounded-2xl border border-border bg-surface p-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">店舗名</label>
          <input
            type="text"
            name="restaurantName"
            defaultValue={settings.restaurantName}
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted">Wi-Fi案内（任意・客側の注文画面に表示）</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="text"
              name="wifiSsid"
              placeholder="ネットワーク名（SSID）"
              defaultValue={settings.wifiSsid ?? ""}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            <input
              type="text"
              name="wifiPassword"
              placeholder="パスワード"
              defaultValue={settings.wifiPassword ?? ""}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          <p className="mt-1 text-xs text-muted">どちらも空欄の場合、客側には表示されません。</p>
        </div>

        <SubmitButton pendingText="保存中…" className="rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-accent-foreground">
          保存する
        </SubmitButton>
      </form>
    </div>
  );
}
