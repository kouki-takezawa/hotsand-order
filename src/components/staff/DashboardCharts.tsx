"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatYen } from "@/lib/format";

// クリーム色の濃淡だけで昼/夜を区別する（ブランドカラーはクリームと白の2色のみ）
const LUNCH_COLOR = "#d8c194";
const DINNER_COLOR = "#8a6a3b";

interface HourlyDatum {
  hour: number;
  lunch: number;
  dinner: number;
}

export function DashboardCharts({
  hourlyBreakdown,
  lunchTotal,
  dinnerTotal,
}: {
  hourlyBreakdown: HourlyDatum[];
  lunchTotal: number;
  dinnerTotal: number;
}) {
  const barData = hourlyBreakdown.map((h) => ({
    hour: `${h.hour}時`,
    amount: h.lunch + h.dinner,
    isLunch: h.lunch >= h.dinner,
  }));

  const pieData = [
    { name: "昼の部", value: lunchTotal, color: LUNCH_COLOR },
    { name: "夜の部", value: dinnerTotal, color: DINNER_COLOR },
  ].filter((d) => d.value > 0);

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-sm font-bold text-foreground">時間帯別売上</h2>
        <p className="mb-4 text-xs text-muted">1時間ごとの注文金額（棒にカーソルを合わせると内訳を表示）</p>
        {barData.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">本日のデータはまだありません</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7dac0" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 12 }} stroke="#8c795c" />
                <YAxis tick={{ fontSize: 12 }} stroke="#8c795c" width={56} tickFormatter={(v) => formatYen(v)} />
                <Tooltip formatter={(value) => formatYen(Number(value))} />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                  {barData.map((entry, index) => (
                    <Cell key={index} fill={entry.isLunch ? LUNCH_COLOR : DINNER_COLOR} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-2 flex gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: DINNER_COLOR }} /> 夜の部
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: LUNCH_COLOR }} /> 昼の部
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-sm font-bold text-foreground">昼の部 / 夜の部 の内訳</h2>
        <p className="mb-4 text-xs text-muted">本日これまでの注文金額の構成比</p>
        {pieData.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">本日のデータはまだありません</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatYen(Number(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
