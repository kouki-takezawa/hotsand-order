import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/apiAuth";
import { getOrderAnalytics, type AnalyticsPeriod } from "@/lib/data";
import { toCsv, toXlsxBlob, csvResponseHeaders, xlsxResponseHeaders, type ExportSheet } from "@/lib/export";

const VALID_PERIODS: AnalyticsPeriod[] = ["today", "7d", "30d"];

export async function GET(request: Request) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const url = new URL(request.url);
  const periodParam = url.searchParams.get("period") ?? "today";
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const period = VALID_PERIODS.includes(periodParam as AnalyticsPeriod) ? (periodParam as AnalyticsPeriod) : "today";

  const analytics = await getOrderAnalytics(period);

  const topItemsSheet: ExportSheet = {
    name: "人気メニュー",
    headers: ["順位", "商品名", "販売数", "売上"],
    rows: analytics.topItems.map((item, i) => [i + 1, item.name, item.quantity, item.revenue]),
  };
  const categorySheet: ExportSheet = {
    name: "カテゴリー別売上",
    headers: ["カテゴリー", "販売数", "売上"],
    rows: analytics.categoryBreakdown.map((c) => [c.name, c.quantity, c.revenue]),
  };

  const filename = `注文分析_${period}.${format}`;
  if (format === "csv") {
    return new NextResponse(toCsv(topItemsSheet), { headers: csvResponseHeaders(filename) });
  }
  const blob = await toXlsxBlob([topItemsSheet, categorySheet]);
  return new NextResponse(blob, { headers: xlsxResponseHeaders(filename) });
}
