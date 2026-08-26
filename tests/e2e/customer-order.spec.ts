import { test, expect } from "@playwright/test";
import { TEST_CATEGORY_NAME, TEST_MENU_ITEM_NAME, TEST_MENU_ITEM_PRICE } from "./constants";

test.describe("客側の注文フロー（注文番号方式・ゴールデンパス）", () => {
  test("メニューをカートに追加して注文し、注文番号画面に反映される", async ({ page }) => {
    await page.goto("/order");

    // E2Eテスト専用カテゴリーに切り替えると、テスト用商品のみが表示される
    await page.getByRole("button", { name: TEST_CATEGORY_NAME, exact: true }).click();
    await expect(page.getByText(TEST_MENU_ITEM_NAME)).toBeVisible();

    // 数量を2に設定
    const increment = page.getByRole("button", { name: "増やす" });
    await increment.click();
    await increment.click();

    // 下部バーに合計金額が反映される（formatYen: ¥1,000 形式）
    await expect(page.getByText(`¥${(TEST_MENU_ITEM_PRICE * 2).toLocaleString("ja-JP")}`)).toBeVisible();

    await page.getByRole("button", { name: "注文する" }).click();

    // 注文番号の確認画面に切り替わり、送信した内容が反映されていることを確認する
    await expect(page.getByText("あなたの注文番号")).toBeVisible();
    await expect(page.getByText(`${TEST_MENU_ITEM_NAME} × 2`)).toBeVisible();
  });
});
