import "../../src/lib/load-env";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/prisma";
import {
  TEST_STAFF_EMAIL,
  TEST_STAFF_PASSWORD,
  TEST_CATEGORY_NAME,
  TEST_MENU_ITEM_NAME,
  TEST_MENU_ITEM_PRICE,
} from "./constants";

// テスト実行前に、E2E専用のスタッフアカウント・メニューを用意する。
// 既存の店舗データ（本番相当のシード/実データ）には一切手を加えず、
// 「無ければ作る／専用の名前のものだけ更新する」方針で冪等に実行できる。
export default async function globalSetup() {
  const passwordHash = await bcrypt.hash(TEST_STAFF_PASSWORD, 10);
  await prisma.staffUser.upsert({
    where: { email: TEST_STAFF_EMAIL },
    update: { passwordHash },
    create: { email: TEST_STAFF_EMAIL, passwordHash, name: "E2Eテスト" },
  });

  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  let category = await prisma.category.findFirst({ where: { name: TEST_CATEGORY_NAME } });
  if (!category) {
    category = await prisma.category.create({ data: { name: TEST_CATEGORY_NAME, sortOrder: 999 } });
  }
  const existingItem = await prisma.menuItem.findFirst({
    where: { name: TEST_MENU_ITEM_NAME, categoryId: category.id },
  });
  if (!existingItem) {
    await prisma.menuItem.create({
      data: {
        categoryId: category.id,
        name: TEST_MENU_ITEM_NAME,
        price: TEST_MENU_ITEM_PRICE,
        isAvailable: true,
      },
    });
  }

  await prisma.$disconnect();
}
