// E2Eテスト専用のスタッフアカウント・メニューデータの名前。
// global-setup.tsが投入し、各specファイルがログイン・注文操作に使う。
// 実店舗のデータと衝突しないよう、既存の名前とは明確に区別できる文字列にしている。
export const TEST_STAFF_EMAIL = "e2e-test@example.com";
export const TEST_STAFF_PASSWORD = "e2e-test-password-1";
export const TEST_CATEGORY_NAME = "E2Eテスト";
export const TEST_MENU_ITEM_NAME = "E2Eテスト商品";
export const TEST_MENU_ITEM_PRICE = 500;
