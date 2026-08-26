// QRコードを読み取った直後に空白のまま固まって見えないようにするための
// 読み込み中スケルトン（/order, /order/[table] の両方に適用される）。
export default function OrderLoading() {
  return (
    <div className="min-h-screen animate-pulse bg-background px-4 pb-28 pt-4" aria-busy="true" aria-label="読み込み中">
      <div className="mb-4 space-y-2">
        <div className="h-3 w-20 rounded-full bg-border" />
        <div className="h-5 w-32 rounded-full bg-border" />
      </div>
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 w-20 shrink-0 rounded-full bg-border" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 py-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded-full bg-border" />
              <div className="h-3 w-1/3 rounded-full bg-border" />
            </div>
            <div className="h-8 w-16 shrink-0 rounded-full bg-border" />
          </div>
        ))}
      </div>
    </div>
  );
}
