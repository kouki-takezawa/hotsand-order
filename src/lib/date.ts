// 日本時間（JST, UTC+9固定・夏時間なし）基準での「本日」の範囲や時間帯を
// 扱うヘルパー。Vercelのサーバーは通常UTCで動くため、DBに保存されたUTCの
// createdAtからJSTでの営業日・時間帯を正しく求めるために使う。

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function getTodayRangeJST(now: Date = new Date()): { start: Date; end: Date } {
  const jstNow = new Date(now.getTime() + JST_OFFSET_MS);
  const y = jstNow.getUTCFullYear();
  const m = jstNow.getUTCMonth();
  const d = jstNow.getUTCDate();
  const startUtcMs = Date.UTC(y, m, d, 0, 0, 0) - JST_OFFSET_MS;
  return { start: new Date(startUtcMs), end: new Date(startUtcMs + 24 * 60 * 60 * 1000) };
}

export function getJSTHour(date: Date): number {
  return new Date(date.getTime() + JST_OFFSET_MS).getUTCHours();
}

// 17時を境に昼の部・夜の部を分ける（固定の目安。営業時間帯はレストランごとに
// 異なるため、必要であれば調整する）。
export function isLunchHour(date: Date): boolean {
  return getJSTHour(date) < 17;
}

// 注文番号カウンタのキーに使う、JST基準の日付文字列（例: "2026-08-21"）。
export function getJSTDateKey(now: Date = new Date()): string {
  const jstNow = new Date(now.getTime() + JST_OFFSET_MS);
  const y = jstNow.getUTCFullYear();
  const m = String(jstNow.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jstNow.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
