import { getDashboardSummary } from "@/lib/data";
import { formatYen } from "@/lib/format";
import { StatCard } from "@/components/staff/StatCard";
import { DashboardCharts } from "@/components/staff/DashboardCharts";

// 集計値をリアルタイムに反映するため、ビルド時の静的プリレンダーを禁止する
export const dynamic = "force-dynamic";

export default async function StaffDashboardPage() {
  const summary = await getDashboardSummary();

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-foreground">売上ダッシュボード</h1>
      <p className="mb-6 text-sm text-muted">本日の状況をリアルタイムに集計</p>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="受け渡し済み（目安）" value={formatYen(summary.confirmedAmount)} />
        <StatCard label="対応待ち（目安）" value={formatYen(summary.pendingAmount)} />
        <StatCard label="本日の注文件数" value={String(summary.orderCount)} unit="件" />
        <StatCard label="客単価（注文平均）" value={formatYen(summary.avgOrderValue)} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 md:w-1/2">
        <StatCard label="受け渡し件数" value={String(summary.servedCount)} unit="件" />
        <StatCard label="取消件数" value={String(summary.cancelledCount)} unit="件" />
      </div>

      <p className="mt-4 text-xs text-muted">
        受け渡し済み＝スタッフが「受渡済み」にした注文　／　対応待ち＝まだ調理中・受付中の注文。会計は別システムで行うため、金額はあくまで目安です。
      </p>

      <DashboardCharts
        hourlyBreakdown={summary.hourlyBreakdown}
        lunchTotal={summary.lunchTotal}
        dinnerTotal={summary.dinnerTotal}
      />
    </div>
  );
}
