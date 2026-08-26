import { test, expect } from "@playwright/test";
import { TEST_STAFF_EMAIL, TEST_STAFF_PASSWORD } from "./constants";

// LoginForm（src/components/staff/LoginForm.tsx）はラベルにhtmlForを
// 設定していないため getByLabel は使えず、type属性で入力欄を特定する。
async function fillLoginForm(page: import("@playwright/test").Page, email: string, password: string) {
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();
}

test.describe("スタッフログイン", () => {
  test("正しい認証情報でログインすると注文管理画面に入れる", async ({ page }) => {
    await page.goto("/staff/login");
    await fillLoginForm(page, TEST_STAFF_EMAIL, TEST_STAFF_PASSWORD);
    await expect(page).toHaveURL(/\/staff\/orders/);
  });

  test("誤ったパスワードではログインできず、汎用的なエラーのみ表示する", async ({ page }) => {
    await page.goto("/staff/login");
    await fillLoginForm(page, TEST_STAFF_EMAIL, "明らかに間違ったパスワード");
    await expect(page.getByText("メールアドレスまたはパスワードが正しくありません")).toBeVisible();
    await expect(page).toHaveURL(/\/staff\/login/);
  });

  test("未ログインで管理画面にアクセスするとログイン画面へリダイレクトされる", async ({ page }) => {
    await page.goto("/staff/orders");
    await expect(page).toHaveURL(/\/staff\/login/);
  });
});
