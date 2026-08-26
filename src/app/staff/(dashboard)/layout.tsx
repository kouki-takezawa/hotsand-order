import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDashboardSummary, getSettings } from "@/lib/data";
import { formatDate, formatYen } from "@/lib/format";
import { Sidebar } from "@/components/staff/Sidebar";
import { MobileNav } from "@/components/staff/MobileNav";

// 本日の売上バッジをリアルタイムに反映するため、ビルド時の静的プリレンダーを禁止する
export const dynamic = "force-dynamic";

export default async function StaffDashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/staff/login");
  }

  const [summary, settings] = await Promise.all([getDashboardSummary(), getSettings()]);
  const dateLabel = formatDate(new Date());

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        restaurantName={settings.restaurantName}
        dateLabel={dateLabel}
        staffName={session.user.email ?? "スタッフ"}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav restaurantName={settings.restaurantName} />
        <div className="hidden items-center justify-end border-b border-border px-6 py-4 md:flex print:hidden">
          <div className="rounded-full border border-border bg-surface px-4 py-2 text-sm">
            <span className="text-muted">本日の売上　</span>
            <span className="font-bold text-foreground">{formatYen(summary.totalToday)}</span>
          </div>
        </div>
        <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
