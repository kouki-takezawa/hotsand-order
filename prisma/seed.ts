// デプロイのたびに実行される初期データ投入スクリプト（package.json の
// vercel-build 参照）。カテゴリ・メニュー・テーブル・スタッフアカウントは
// 設定画面から編集できるようになったため、このスクリプトは「まだデータが
// 何もない場合にだけ」初期値を投入する（既存データは一切上書きしない）。
import "../src/lib/load-env";
import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";
import { CURRENT_MENU } from "./menu-data";

async function main() {
  // --- 設定（シングルトン行）。なければ作成するだけで、既存の設定は変更しない ---
  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", restaurantName: "ホットサンドスタンド" },
  });

  // --- スタッフアカウント: 1件も無いときだけ、環境変数から初期アカウントを作る ---
  const staffCount = await prisma.staffUser.count();
  if (staffCount === 0) {
    const staffEmail = (process.env.STAFF_EMAIL ?? "staff@example.com").trim().toLowerCase();
    const staffPassword = process.env.STAFF_PASSWORD ?? "changeme1234";
    const passwordHash = await bcrypt.hash(staffPassword, 10);
    await prisma.staffUser.create({
      data: { email: staffEmail, passwordHash, name: "スタッフ" },
    });
    console.log(`Created initial staff account: ${staffEmail}`);
  }

  // --- テーブル: 1件も無いときだけ、初期テーブルを作る -------------------------
  const tableCount = await prisma.restaurantTable.count();
  if (tableCount === 0) {
    const count = Number(process.env.TABLE_COUNT ?? 8);
    for (let number = 1; number <= count; number++) {
      await prisma.restaurantTable.create({ data: { number, name: `卓${number}` } });
    }
    console.log(`Created ${count} initial tables`);
  }

  // --- カテゴリ + メニュー: カテゴリが1件も無いときだけ初期メニューを作る ---------
  // 内容は prisma/menu-data.ts（現在のメニュー「ホットサンドスタンド MENU」の
  // データ化）を参照する。既存のDBにすでに旧メニューが入っている場合は、このseedでは
  // 上書きされない（下記の説明の通り）ので、`npm run db:reset-menu` を使うこと。
  const categoryCount = await prisma.category.count();
  if (categoryCount === 0) {
    for (const category of CURRENT_MENU) {
      const cat = await prisma.category.create({ data: { name: category.name, sortOrder: category.sortOrder } });
      for (let i = 0; i < category.items.length; i++) {
        const item = category.items[i];
        await prisma.menuItem.create({
          data: {
            categoryId: cat.id,
            name: item.name,
            price: item.price,
            description: item.description,
            isRecommended: item.isRecommended ?? false,
            sortOrder: i,
          },
        });
      }
    }
    console.log("Created initial menu");
  }

  console.log("Seed check complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
