import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/apiAuth";
import { getPeriodAnalysis, type ReportPeriod } from "@/lib/data";
import { toCsv, toXlsxBlob, csvResponseHeaders, xlsxResponseHeaders } from "@/lib/export";

const VALID_PERIODS: ReportPeriod[] = ["7d", "30d", "90d"];

export async function GET(request: Request) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const url = new URL(request.url);
  const periodParam = url.searchParams.get("period") ?? "7d";
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const period = VALID_PERIODS.includes(periodParam as ReportPeriod) ? (periodParam as ReportPeriod) : "7d";

  const report = await getPeriodAnalysis(period);

  const sheet = {
    name: "期間分析",
    headers: ["日付", "確定売上", "見込み売上", "合計", "注文件数", "取消件数"],
    rows: report.daily.map((d) => [d.date, d.confirmed, d.pending, d.total, d.orderCount, d.cancelledCount]),
  };

  const filename = `期間分析_${period}.${format}`;
  if (format === "csv") {
    return new NextResponse(toCsv(sheet), { headers: csvResponseHeaders(filename) });
  }
  const blob = await toXlsxBlob([sheet]);
  return new NextResponse(blob, { headers: xlsxResponseHeaders(filename) });
}
