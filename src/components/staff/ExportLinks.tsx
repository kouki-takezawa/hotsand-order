// CSV/Excelダウンロードリンク。ダウンロードはブラウザ標準のリンク遷移
// （Content-Dispositionヘッダー）で行うため、クライアントJSは不要。
export function ExportLinks({
  href,
  params,
  className,
}: {
  href: string;
  params?: Record<string, string>;
  className?: string;
}) {
  const base = params ? `${href}?${new URLSearchParams(params).toString()}&` : `${href}?`;
  return (
    <div className={`flex shrink-0 gap-2 ${className ?? ""}`}>
      <a href={`${base}format=csv`} className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground">
        CSV
      </a>
      <a href={`${base}format=xlsx`} className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground">
        Excel
      </a>
    </div>
  );
}
