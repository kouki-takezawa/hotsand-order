import "server-only";
import type { headers } from "next/headers";

// QRコードなどに埋め込む絶対URLのベースを決める。
//
// リクエストヘッダー（x-forwarded-host等）から動的に組み立てる方法は、Vercelの
// プレビューURLやデプロイ固有のURL経由でアクセスした場合にそのURLを拾って
// しまい、印刷して店舗に貼るQRコードのURLが安定しない・正しくない、という問題
// が起きる。そのため本番では NEXT_PUBLIC_APP_URL（例:
// https://chil-terrace-order.vercel.app）を明示的に優先し、未設定のとき
// （ローカル開発など）だけリクエストヘッダーから推測する。
export function getBaseUrl(headerList: Awaited<ReturnType<typeof headers>>): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
