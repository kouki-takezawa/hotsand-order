"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/staff/orders", label: "注文管理" },
  { href: "/staff/dashboard", label: "売上" },
  { href: "/staff/analytics", label: "注文分析" },
  { href: "/staff/reports", label: "期間分析" },
  { href: "/staff/settings", label: "設定" },
];

export function MobileNav({ restaurantName }: { restaurantName: string }) {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-20 border-b border-border bg-background md:hidden print:hidden">
      <p className="px-4 pt-3 text-sm font-bold text-foreground">{restaurantName}</p>
      <nav className="flex gap-2 overflow-x-auto px-4 py-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                active ? "bg-accent text-accent-foreground" : "border border-border text-muted"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
