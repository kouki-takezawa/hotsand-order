"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/apiAuth";
import { isUniqueConstraintError } from "@/lib/prisma";
import {
  updateSettings,
  createCategory,
  renameCategory,
  deleteCategory,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  createLocation,
  renameLocation,
  deleteLocation,
  setLocationPaused,
  createStaffAccount,
  deleteStaffAccount,
  resetStaffPassword,
  createStaffInvite,
  deleteStaffInvite,
} from "@/lib/data";
import { ALLERGEN_CODES } from "@/lib/format";

async function requireAuth() {
  const session = await requireStaffSession();
  if (!session) throw new Error("認証が必要です");
}

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** ドメインエラーを ?error= 付きリダイレクトに変換して、フォームの画面に友好的な
 *  メッセージで表示できるようにする（例外を投げっぱなしにしてerror.tsxに
 *  落とさないようにするため）。 */
async function runOrRedirectWithError(path: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : "処理に失敗しました";
    redirect(`${path}?error=${encodeURIComponent(message)}`);
  }
}

// ---- 一般設定 ---------------------------------------------------------------

export async function updateGeneralSettingsAction(formData: FormData) {
  await requireAuth();
  const restaurantName = str(formData, "restaurantName");
  const wifiSsid = str(formData, "wifiSsid");
  const wifiPassword = str(formData, "wifiPassword");
  const orderingPaused = formData.get("orderingPaused") === "on";
  await updateSettings({
    restaurantName: restaurantName || undefined,
    wifiSsid: wifiSsid || null,
    wifiPassword: wifiPassword || null,
    orderingPaused,
  });
  revalidatePath("/staff", "layout");
  revalidatePath("/order");
}

// ---- メニュー -----------------------------------------------------------------

export async function addCategoryAction(formData: FormData) {
  await requireAuth();
  const name = str(formData, "name");
  if (!name) return;
  await createCategory(name);
  revalidatePath("/staff/settings/menu");
}

export async function renameCategoryAction(formData: FormData) {
  await requireAuth();
  const id = str(formData, "id");
  const name = str(formData, "name");
  if (!id || !name) return;
  await renameCategory(id, name);
  revalidatePath("/staff/settings/menu");
}

export async function deleteCategoryAction(formData: FormData) {
  await requireAuth();
  const id = str(formData, "id");
  if (!id) return;
  await runOrRedirectWithError("/staff/settings/menu", () => deleteCategory(id));
  revalidatePath("/staff/settings/menu");
}

function allergensFromForm(formData: FormData): string {
  return ALLERGEN_CODES.filter((code) => formData.get(`allergen_${code}`) === "on").join(",");
}

function stockCountFromForm(formData: FormData): number | null {
  const raw = str(formData, "stockCount");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

export async function addMenuItemAction(formData: FormData) {
  await requireAuth();
  const categoryId = str(formData, "categoryId");
  const name = str(formData, "name");
  const price = Number(str(formData, "price"));
  const description = str(formData, "description");
  const isRecommended = formData.get("isRecommended") === "on";
  const allergens = allergensFromForm(formData);
  const imageUrl = str(formData, "imageUrl");
  const stockCount = stockCountFromForm(formData);
  if (!categoryId || !name || !Number.isFinite(price) || price < 0) return;
  await createMenuItem({
    categoryId,
    name,
    price,
    description: description || undefined,
    isRecommended,
    allergens: allergens || undefined,
    imageUrl: imageUrl || undefined,
    stockCount,
  });
  revalidatePath("/staff/settings/menu");
}

export async function updateMenuItemAction(formData: FormData) {
  await requireAuth();
  const id = str(formData, "id");
  const name = str(formData, "name");
  const price = Number(str(formData, "price"));
  const description = str(formData, "description");
  const isRecommended = formData.get("isRecommended") === "on";
  const isAvailable = formData.get("isAvailable") === "on";
  const allergens = allergensFromForm(formData);
  const pendingPriceRaw = str(formData, "pendingPrice");
  const applyAtRaw = str(formData, "applyAt");
  const imageUrl = str(formData, "imageUrl");
  const stockCount = stockCountFromForm(formData);
  if (!id || !name || !Number.isFinite(price) || price < 0) return;

  const pendingPrice = pendingPriceRaw ? Number(pendingPriceRaw) : null;
  const applyAt = applyAtRaw ? new Date(`${applyAtRaw}T00:00:00`) : null;

  await updateMenuItem(id, {
    name,
    price,
    description: description || null,
    isRecommended,
    isAvailable,
    allergens: allergens || null,
    pendingPrice: pendingPrice != null && Number.isFinite(pendingPrice) ? pendingPrice : null,
    applyAt,
    imageUrl: imageUrl || null,
    stockCount,
  });
  revalidatePath("/staff/settings/menu");
}

export async function cancelScheduledPriceAction(formData: FormData) {
  await requireAuth();
  const id = str(formData, "id");
  if (!id) return;
  await updateMenuItem(id, { pendingPrice: null, applyAt: null });
  revalidatePath("/staff/settings/menu");
}

export async function deleteMenuItemAction(formData: FormData) {
  await requireAuth();
  const id = str(formData, "id");
  if (!id) return;
  await runOrRedirectWithError("/staff/settings/menu", () => deleteMenuItem(id));
  revalidatePath("/staff/settings/menu");
}

// ---- 設置場所 -----------------------------------------------------------------

export async function addLocationAction(formData: FormData) {
  await requireAuth();
  const name = str(formData, "name");
  if (!name) return;
  await createLocation(name);
  revalidatePath("/staff/settings/locations");
  revalidatePath("/staff/settings/qr");
}

export async function renameLocationAction(formData: FormData) {
  await requireAuth();
  const id = str(formData, "id");
  const name = str(formData, "name");
  if (!id || !name) return;
  await renameLocation(id, name);
  revalidatePath("/staff/settings/locations");
  revalidatePath("/staff/settings/qr");
}

export async function deleteLocationAction(formData: FormData) {
  await requireAuth();
  const id = str(formData, "id");
  if (!id) return;
  await runOrRedirectWithError("/staff/settings/locations", () => deleteLocation(id));
  revalidatePath("/staff/settings/locations");
  revalidatePath("/staff/settings/qr");
}

export async function toggleLocationPausedAction(formData: FormData) {
  await requireAuth();
  const id = str(formData, "id");
  const isPaused = str(formData, "isPaused") === "true";
  if (!id) return;
  await setLocationPaused(id, isPaused);
  revalidatePath("/staff/settings/locations");
}

// ---- アカウント ---------------------------------------------------------------

export async function addAccountAction(formData: FormData) {
  await requireAuth();
  const email = str(formData, "email");
  const name = str(formData, "name");
  const password = str(formData, "password");
  if (!email || !name || password.length < 8) {
    redirect("/staff/settings/accounts?error=" + encodeURIComponent("メール・名前・8文字以上のパスワードを入力してください"));
  }
  await runOrRedirectWithError("/staff/settings/accounts", async () => {
    try {
      await createStaffAccount(email, name, password);
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new Error("このメールアドレスは既に使われています");
      throw error;
    }
  });
  revalidatePath("/staff/settings/accounts");
}

export async function deleteAccountAction(formData: FormData) {
  await requireAuth();
  const id = str(formData, "id");
  if (!id) return;
  await runOrRedirectWithError("/staff/settings/accounts", () => deleteStaffAccount(id));
  revalidatePath("/staff/settings/accounts");
}

export async function resetPasswordAction(formData: FormData) {
  await requireAuth();
  const id = str(formData, "id");
  const password = str(formData, "password");
  if (!id || password.length < 8) {
    redirect("/staff/settings/accounts?error=" + encodeURIComponent("パスワードは8文字以上にしてください"));
  }
  await resetStaffPassword(id, password);
  revalidatePath("/staff/settings/accounts");
}

// ---- 招待コード ---------------------------------------------------------------

export async function createInviteAction(formData: FormData) {
  await requireAuth();
  const note = str(formData, "note");
  const expiresInDaysRaw = str(formData, "expiresInDays");
  const expiresInDays = expiresInDaysRaw ? Number(expiresInDaysRaw) : undefined;
  await createStaffInvite(note || undefined, expiresInDays && Number.isFinite(expiresInDays) ? expiresInDays : undefined);
  revalidatePath("/staff/settings/invites");
}

export async function deleteInviteAction(formData: FormData) {
  await requireAuth();
  const id = str(formData, "id");
  if (!id) return;
  await deleteStaffInvite(id);
  revalidatePath("/staff/settings/invites");
}
