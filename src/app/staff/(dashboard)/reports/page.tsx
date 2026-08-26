import Link from "next/link";
import { getPeriodAnalysis, type ReportPeriod } from "@/lib/data";
import { formatYen } from "@/lib/format";
import { StatCard } from "@/components/staff/StatCard";
import { PeriodChart } from "@/components/staff/PeriodChart";
import { ExportLinks } from "@/components/staff/ExportLinks";

const PERIOD_LABEL: Record<ReportPeriod, string> = { "7d": "過去7日間", "30d": "過去30日間", "90d": "過去90日間" };

export default async function StaffReportsPage(props: PageProps<"/staff/reports">) {
  const { period: periodParam } = await props.searchParams;
  const period: ReportPeriod = periodParam === "30d" || periodParam === "90d" ? periodParam : "7d";
  const report = await getPeriodAnalysis(period);

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-foreground">期間分析</h1>
      <p className="mb-4 text-sm text-muted">日ごとの売上を比較・集計します</p>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border">
        <div className="flex gap-1">
          {(Object.keys(PERIOD_LABEL) as ReportPeriod[]).map((p) => (
            <Link
              key={p}
              href={`/staff/reports?period=${p}`}
              className={`border-b-2 px-4 py-2 text-sm font-medium ${
                period === p ? "border-accent text-foreground" : "border-transparent text-muted"
              }`}
            >
              {PERIOD_LABEL[p]}
            </Link>
          ))}
        </div>
        <ExportLinks href="/api/staff/export/reports" params={{ period }} className="mb-2" />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="期間合計売上" value={formatYen(report.totalRevenue)} />
        <StatCard label="期間注文件数" value={String(report.totalOrders)} unit="件" />
        <StatCard label="客単価（期間平均）" value={formatYen(report.avgOrderValue)} />
        <StatCard label="取消件数" value={String(report.totalCancelled)} unit="件" />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-sm font-bold text-foreground">日別売上</h2>
        <p className="mb-4 text-xs text-muted">{PERIOD_LABEL[period]}の1日ごとの売上</p>
        <PeriodChart daily={report.daily} />
      </div>
    </div>
  );
}
