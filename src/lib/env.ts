// src/lib/env.ts
//
// Postgres接続文字列の解決をここに集約する。
//
// Vercelでのプロビジョニング方法によって、同じ用途でも環境変数名が異なる:
//  - Prisma Postgres（Vercel Marketplace経由）: DATABASE_URL / POSTGRES_URL /
//    PRISMA_DATABASE_URL が同一のプール済み接続文字列を指す。
//  - 旧来の "Vercel Postgres"（Neon）連携: POSTGRES_PRISMA_URL（プール）と
//    POSTGRES_URL_NON_POOLING（直接接続）が別々に払い出される。
//  - PRISMA_DATABASE_URL は `prisma+postgres://` という Accelerate プロキシの
//    URLである場合があり、これは @prisma/adapter-pg（pgドライバベース）では
//    使えない。plain な postgres:// / postgresql:// であることを確認した上で
//    最後のフォールバックとしてのみ使う。
//
// prisma.config.ts（CLI）と src/lib/prisma.ts（実行時のPrismaClient）は、
// どちらも固定の環境変数名を直接読まずにこのヘルパー経由で接続文字列を解決する。

const ACCELERATE_SCHEME = "prisma+postgres://";
const PLAIN_POSTGRES_SCHEMES = ["postgres://", "postgresql://"];

function isPlainPostgresUrl(value: string): boolean {
  return PLAIN_POSTGRES_SCHEMES.some((scheme) => value.startsWith(scheme));
}

function isAccelerateUrl(value: string): boolean {
  return value.startsWith(ACCELERATE_SCHEME);
}

interface Candidate {
  name: string;
  accept?: (value: string) => boolean;
}

interface ResolvedDatabaseUrl {
  url: string;
  source: string;
}

function resolveFromCandidates(candidates: Candidate[]): ResolvedDatabaseUrl | undefined {
  for (const candidate of candidates) {
    const value = process.env[candidate.name];
    if (!value) continue;
    if (isAccelerateUrl(value)) continue;

    const accept = candidate.accept ?? (() => true);
    if (!accept(value)) continue;

    return { url: value, source: candidate.name };
  }
  return undefined;
}

function formatCheckedList(candidates: Candidate[]): string {
  return candidates
    .map((c) => (c.accept ? `${c.name} (plain postgres:// の場合のみ)` : c.name))
    .join(", ");
}

/**
 * 実行時（@prisma/adapter-pg）で使うプール接続用の接続文字列を解決する。
 * 優先順: DATABASE_URL -> POSTGRES_URL -> POSTGRES_PRISMA_URL ->
 * PRISMA_DATABASE_URL（plain postgres:// の場合のみ）
 */
export function resolvePooledDatabaseUrl(): ResolvedDatabaseUrl {
  const candidates: Candidate[] = [
    { name: "DATABASE_URL" },
    { name: "POSTGRES_URL" },
    { name: "POSTGRES_PRISMA_URL" },
    { name: "PRISMA_DATABASE_URL", accept: isPlainPostgresUrl },
  ];

  const resolved = resolveFromCandidates(candidates);
  if (!resolved) {
    throw new Error(
      "データベース接続文字列（プール接続用）が見つかりません。" +
        ` 次の環境変数を確認しましたが、いずれも未設定か使用できない形式でした: ${formatCheckedList(candidates)}.` +
        " Vercel の Project Settings > Environment Variables で Postgres が接続されているか、" +
        " ローカルでは .env.local を確認してください。"
    );
  }
  return resolved;
}

/**
 * `prisma db push` など、CLIのDDL操作で使う直接接続用の接続文字列を解決する。
 * 優先順: POSTGRES_URL_NON_POOLING -> POSTGRES_URL -> DATABASE_URL
 */
export function resolveDirectDatabaseUrl(): ResolvedDatabaseUrl {
  const candidates: Candidate[] = [
    { name: "POSTGRES_URL_NON_POOLING" },
    { name: "POSTGRES_URL" },
    { name: "DATABASE_URL" },
  ];

  const resolved = resolveFromCandidates(candidates);
  if (!resolved) {
    throw new Error(
      "データベース接続文字列（直接接続用）が見つかりません。" +
        ` 次の環境変数を確認しましたが、いずれも未設定か使用できない形式でした: ${formatCheckedList(candidates)}.` +
        " Vercel の Project Settings > Environment Variables で Postgres が接続されているか、" +
        " ローカルでは .env.local を確認してください。"
    );
  }
  return resolved;
}
