// ページ切り替え時に即座に表示される読み込み中スケルトン。サーバーの
// レスポンスを待つあいだ画面が固まって見えないよう、Next.jsのloading.tsx
// 規約に沿って、このセグメント配下（/staff/*の各ページ）の遷移すべてに
// 自動的に適用される。
export default function StaffDashboardLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="読み込み中">
      <div className="space-y-2">
        <div className="h-6 w-40 rounded-full bg-border" />
        <div className="h-4 w-64 rounded-full bg-border" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl border border-border bg-surface p-4">
            <div className="mb-3 h-4 w-24 rounded-full bg-border" />
            <div className="h-3 w-full rounded-full bg-border" />
            <div className="mt-2 h-3 w-3/4 rounded-full bg-border" />
          </div>
        ))}
      </div>
    </div>
  );
}
