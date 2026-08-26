"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { staffSignOut } from "@/app/staff/actions";

const NAV_ITEMS = [
  { href: "/staff/orders", label: "注文管理" },
  { href: "/staff/dashboard", label: "売上ダッシュボード" },
  { href: "/staff/analytics", label: "注文分析" },
  { href: "/staff/reports", label: "期間分析" },
  { href: "/staff/settings", label: "設定" },
];

export function Sidebar({
  restaurantName,
  dateLabel,
  staffName,
}: {
  restaurantName: string;
  dateLabel: string;
  staffName: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col justify-between border-r border-border bg-background px-4 py-6 md:flex print:hidden">
      <div>
        <p className="text-base font-bold text-foreground">{restaurantName}</p>
        <p className="mt-0.5 text-xs text-muted">{dateLabel}</p>

        <nav className="mt-6 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "border border-border bg-surface font-semibold text-foreground shadow-sm"
                    : "text-muted hover:bg-surface"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-border pt-4">
        <p className="truncate text-xs text-muted">{staffName}</p>
        <form action={staffSignOut}>
          <button type="submit" className="mt-1 text-xs text-muted underline underline-offset-4">
            ログアウト
          </button>
        </form>
      </div>
    </aside>
  );
}
