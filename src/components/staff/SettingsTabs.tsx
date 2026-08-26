"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SettingsTabs({ showTables }: { showTables: boolean }) {
  const pathname = usePathname();

  const tabs = [
    { href: "/staff/settings/general", label: "一般" },
    { href: "/staff/settings/menu", label: "メニュー" },
    ...(showTables ? [{ href: "/staff/settings/tables", label: "テーブル" }] : []),
    { href: "/staff/settings/qr", label: "QRコード" },
    { href: "/staff/settings/accounts", label: "アカウント" },
    { href: "/staff/settings/invites", label: "招待コード" },
  ];

  return (
    <div className="flex gap-1 border-b border-border">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              active ? "border-accent text-foreground" : "border-transparent text-muted"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
