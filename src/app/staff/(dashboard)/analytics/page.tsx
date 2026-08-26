import Link from "next/link";
import { getOrderAnalytics, type AnalyticsPeriod } from "@/lib/data";
import { formatYen } from "@/lib/format";
import { StatCard } from "@/components/staff/StatCard";
import { CategoryPie } from "@/components/staff/CategoryPie";
import { ExportLinks } from "@/components/staff/ExportLinks";

const PERIOD_LABEL: Record<AnalyticsPeriod, string> = { today: "本日", "7d": "過去7日間", "30d": "過去30日間" };

export default async function StaffAnalyticsPage(props: PageProps<"/staff/analytics">) {
  const { period: periodParam } = await props.searchParams;
  const period: AnalyticsPeriod = periodParam === "today" || periodParam === "30d" ? periodParam : "7d";
  const analytics = await getOrderAnalytics(period);

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-foreground">注文分析</h1>
      <p className="mb-4 text-sm text-muted">人気メニューや時間帯ごとの注文傾向を分析します</p>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border">
        <div className="flex gap-1">
          {(Object.keys(PERIOD_LABEL) as AnalyticsPeriod[]).map((p) => (
            <Link
              key={p}
              href={`/staff/analytics?period=${p}`}
              className={`border-b-2 px-4 py-2 text-sm font-medium ${
                period === p ? "border-accent text-foreground" : "border-transparent text-muted"
              }`}
            >
              {PERIOD_LABEL[p]}
            </Link>
          ))}
        </div>
        <ExportLinks href="/api/staff/export/analytics" params={{ period }} className="mb-2" />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="注文件数" value={String(analytics.orderCount)} unit="件" />
        <StatCard label="売上" value={formatYen(analytics.totalRevenue)} />
        <StatCard label="平均注文点数" value={String(analytics.avgItemsPerOrder)} unit="点" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-sm font-bold text-foreground">人気メニュー</h2>
          <p className="mb-4 text-xs text-muted">販売数の多い順（上位10件）</p>
          {analytics.topItems.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">データがありません</p>
          ) : (
            <ol className="space-y-2">
              {analytics.topItems.map((item, index) => (
                <li key={item.name} className="flex items-center gap-3 text-sm">
                  <span className="w-5 shrink-0 text-right text-xs text-muted">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-foreground">{item.name}</span>
                  <span className="shrink-0 text-muted">{item.quantity}点</span>
                  <span className="w-20 shrink-0 text-right font-medium text-foreground">{formatYen(item.revenue)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-sm font-bold text-foreground">カテゴリー別の売上構成</h2>
          <p className="mb-4 text-xs text-muted">{PERIOD_LABEL[period]}の売上をカテゴリーごとに集計</p>
          <CategoryPie data={analytics.categoryBreakdown} />
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 xl:col-span-2">
          <h2 className="text-sm font-bold text-foreground">設置場所別の注文状況</h2>
          <p className="mb-4 text-xs text-muted">{PERIOD_LABEL[period]}に、どの設置場所からどれだけ注文されたか</p>
          {analytics.locationBreakdown.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">データがありません</p>
          ) : (
            <ul className="space-y-2">
              {analytics.locationBreakdown.map((loc) => (
                <li key={loc.name} className="flex items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate text-foreground">{loc.name}</span>
                  <span className="shrink-0 text-muted">{loc.orderCount}件</span>
                  <span className="w-24 shrink-0 text-right font-medium text-foreground">{formatYen(loc.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
