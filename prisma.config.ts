// Prisma CLI（generate / db push / studio など）の設定ファイル。
// DDL操作（`db push`）はトランザクションモードのプーラー経由だと不安定なため、
// 直接（非プール）接続文字列を使う。アプリ実行時は src/lib/prisma.ts が
// プール接続文字列を使ったドライバアダプタで別途接続する。
// ローカル開発では .env.local に接続文字列を置く（Next.js dev serverと同じ
// 場所）。Vercel上のビルドでは環境変数がプラットフォームから直接注入される
// ため、このファイルが存在しなくても問題ない。
import "./src/lib/load-env";
import { defineConfig } from "prisma/config";
import { resolveDirectDatabaseUrl } from "./src/lib/env";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: resolveDirectDatabaseUrl().url,
  },
});
