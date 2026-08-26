import "server-only";

// プロセス内メモリだけで完結する簡易なスライディングウィンドウ・レート制限。
// Vercelのサーバーレス関数は複数インスタンスに分散しうるため、これは
// 「1インスタンスあたりの上限」でしかなく、インスタンス間で共有されない。
// それでも、悪意のある自動送信によるいたずら注文を大きく減らす効果はあるため、
// Redis等の新しいインフラを追加せずに実装できる現実的な対策として採用する。

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

/**
 * key（例: 卓番号+IPアドレス）ごとに、windowMs の間に limit 回まで許可する。
 * 上限を超えていれば false を返す。
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= limit) {
    buckets.set(key, bucket);
    return false;
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);

  // メモリが際限なく増えないよう、たまに古いバケットを掃除する。
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (b.timestamps.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }

  return true;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
