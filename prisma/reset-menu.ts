// 既存のメニュー（元データ）を、prisma/menu-data.ts の内容（現在のメニュー「ホットサンドスタンド
// 〜Terrace酒場〜 FOOD MENU」）で一括置き換えする、手動で一度だけ実行するスクリプト。
// `npm run db:seed`（＝prisma/seed.ts）はDBが空のときにしか初期データを入れないため、
// すでに旧メニューが投入済みの環境（本番など）を新メニューに更新するにはこちらを使う。
//
// 実行方法: DATABASE_URL 等を .env.local に設定した上で `npm run db:reset-menu`
//
// 安全のための方針:
// - 注文履歴（OrderItem）が一件も無い商品は完全に削除する。
// - 注文履歴がある商品は削除できない（外部キー制約・過去の売上集計を壊さないため）
//   ので、設定画面の「販売停止」と同じ扱いで isAvailable=false にするだけに留める
//   （客側のメニューには出なくなるが、売上・分析画面の過去データはそのまま残る）。
// - 商品が0件になったカテゴリーは削除する。
// - 新メニューの投入は名前で照合し、既存なら更新・無ければ作成するため、
//   このスクリプトを複数回実行しても重複は作られない（再実行安全）。
import "../src/lib/load-env";
import { prisma } from "../src/lib/prisma";
import { CURRENT_MENU } from "./menu-data";

async function main() {
  const existingItems = await prisma.menuItem.findMany({
    select: { id: true, categoryId: true, name: true, _count: { select: { orderItems: true } } },
  });

  let deletedCount = 0;
  let discontinuedCount = 0;

  for (const item of existingItems) {
    if (item._count.orderItems === 0) {
      await prisma.menuItem.delete({ where: { id: item.id } });
      deletedCount++;
    } else {
      await prisma.menuItem.update({ where: { id: item.id }, data: { isAvailable: false } });
      discontinuedCount++;
    }
  }
  console.log(`Removed ${deletedCount} old menu item(s) with no order history`);
  if (discontinuedCount > 0) {
    console.log(
      `Discontinued ${discontinuedCount} old menu item(s) that have order history (kept for past sales data, hidden from customers)`
    );
  }

  const emptyCategories = await prisma.category.findMany({ include: { _count: { select: { menuItems: true } } } });
  for (const category of emptyCategories) {
    if (category._count.menuItems === 0) {
      await prisma.category.delete({ where: { id: category.id } });
      console.log(`Removed empty category: ${category.name}`);
    }
  }

  let createdItems = 0;
  let updatedItems = 0;

  for (const category of CURRENT_MENU) {
    const existingCategory = await prisma.category.findFirst({ where: { name: category.name } });
    const cat = existingCategory
      ? await prisma.category.update({ where: { id: existingCategory.id }, data: { sortOrder: category.sortOrder } })
      : await prisma.category.create({ data: { name: category.name, sortOrder: category.sortOrder } });

    for (let i = 0; i < category.items.length; i++) {
      const item = category.items[i];
      const existing = await prisma.menuItem.findFirst({ where: { categoryId: cat.id, name: item.name } });
      const data = {
        price: item.price,
        description: item.description ?? null,
        isRecommended: item.isRecommended ?? false,
        isAvailable: true,
        sortOrder: i,
      };
      if (existing) {
        await prisma.menuItem.update({ where: { id: existing.id }, data });
        updatedItems++;
      } else {
        await prisma.menuItem.create({ data: { ...data, categoryId: cat.id, name: item.name } });
        createdItems++;
      }
    }
  }

  console.log(`Menu reset complete: ${createdItems} item(s) created, ${updatedItems} item(s) updated`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
