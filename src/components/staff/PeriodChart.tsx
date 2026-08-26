"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatYen } from "@/lib/format";

interface DailyDatum {
  date: string;
  total: number;
  orderCount: number;
}

function formatDateLabel(dateKey: string): string {
  const [, m, d] = dateKey.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export function PeriodChart({ daily }: { daily: DailyDatum[] }) {
  if (daily.every((d) => d.total === 0)) {
    return <p className="py-16 text-center text-sm text-muted">データがありません</p>;
  }

  const data = daily.map((d) => ({ ...d, label: formatDateLabel(d.date) }));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7dac0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#8c795c" interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 12 }} stroke="#8c795c" width={56} tickFormatter={(v) => formatYen(v)} />
          <Tooltip
            formatter={(value, name) => (name === "total" ? formatYen(Number(value)) : value)}
            labelFormatter={(label) => label}
          />
          <Bar dataKey="total" name="売上" radius={[4, 4, 0, 0]} fill="#8a6a3b" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
