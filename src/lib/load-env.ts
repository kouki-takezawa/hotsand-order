// スタンドアロンで実行されるスクリプト（prisma/seed.ts, prisma.config.ts）用の
// 副作用インポート。ESモジュールではimport宣言が他の文より先に評価される
// ため、process.envを読むモジュール（src/lib/prisma.tsなど）より前に
// このファイルを一番最初にimportして .env.local を読み込ませる必要がある。
// Next.js経由の実行（devサーバー/ビルド）ではNext.js自身が.env.localを
// 読み込むため、このファイルは使われない。
import { config } from "dotenv";

config({ path: ".env.local" });
config();
