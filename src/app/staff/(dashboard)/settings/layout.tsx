import type { ReactNode } from "react";
import { getSettings } from "@/lib/data";
import { SettingsTabs } from "@/components/staff/SettingsTabs";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const settings = await getSettings();

  return (
    <div>
      <div className="print:hidden">
        <h1 className="mb-1 text-xl font-bold text-foreground">設定</h1>
        <p className="mb-6 text-sm text-muted">
          店舗の運用方式・メニュー・{settings.operationMode === "table" ? "テーブル・" : ""}
          アカウントを管理します
        </p>
        <SettingsTabs showTables={settings.operationMode === "table"} />
      </div>
      <div className="mt-6 print:mt-0">{children}</div>
    </div>
  );
}
