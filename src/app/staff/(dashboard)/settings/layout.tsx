import type { ReactNode } from "react";
import { SettingsTabs } from "@/components/staff/SettingsTabs";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <div className="print:hidden">
        <h1 className="mb-1 text-xl font-bold text-foreground">設定</h1>
        <p className="mb-6 text-sm text-muted">店舗のメニュー・アカウントを管理します</p>
        <SettingsTabs />
      </div>
      <div className="mt-6 print:mt-0">{children}</div>
    </div>
  );
}
