import { test, expect } from "@playwright/test";
import { TEST_CATEGORY_NAME, TEST_MENU_ITEM_NAME, TEST_MENU_ITEM_PRICE } from "./constants";

function orderUrl(): string {
  const number = process.env.E2E_TABLE_NUMBER;
  const token = process.env.E2E_TABLE_TOKEN;
  if (!number || !token) {
    throw new Error("E2E_TABLE_NUMBER / E2E_TABLE_TOKEN が設定されていません（global-setupが未実行の可能性があります）");
  }
  return `/order/${number}?t=${encodeURIComponent(token)}`;
}

test.describe("客側の注文フロー（卓方式・ゴールデンパス）", () => {
  test("メニューをカートに追加して注文し、注文履歴に反映される", async ({ page }) => {
    await page.goto(orderUrl());

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
    await expect(page.getByText("注文を受け付けました")).toBeVisible();

    // 注文履歴を開いて、送信した内容が反映されていることを確認する
    await page.getByRole("button", { name: /注文履歴・合計/ }).click();
    await expect(page.getByText(`${TEST_MENU_ITEM_NAME} × 2`)).toBeVisible();
  });
});
