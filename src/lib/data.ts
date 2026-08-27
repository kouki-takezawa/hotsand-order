import "server-only";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma, isUniqueConstraintError } from "./prisma";
import { getTodayRangeJST, isLunchHour, getJSTDateKey } from "./date";
import { sendPushNotification, type PushSubscriptionData } from "./push";
import type { Order, OrderItem } from "@prisma/client";

export const ACTIVE_STATUSES = ["pending", "preparing", "served"] as const;
export type OrderStatus = "pending" | "preparing" | "served" | "cancelled";

type OrderWithItems = Order & { items: OrderItem[] };

// 合計金額の計算だけが目的の集計クエリ（ダッシュボード・分析・フロア状況など）
// では、表示用のname/idまで持つ全カラムのOrderItemを取得する必要はない。
// price/quantityだけをselectして転送量を減らした結果にも使えるよう、
// orderTotalの実体をこちらに分離しておく。
function itemsTotal(items: { price: number; quantity: number }[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function orderTotal(order: OrderWithItems): number {
  return itemsTotal(order.items);
}

// 客側のAPIレスポンスからpushSubscription（Web Push購読情報）を取り除く。
// 送信者本人に対してであっても、公開APIのレスポンスに残す理由がないため。
export function toPublicOrder<T extends { pushSubscription?: unknown }>(order: T): Omit<T, "pushSubscription"> {
  const rest: Partial<T> = { ...order };
  delete rest.pushSubscription;
  return rest as Omit<T, "pushSubscription">;
}

// ---- 設定 -------------------------------------------------------------

export async function getSettings() {
  const existing = await prisma.settings.findUnique({ where: { id: "singleton" } });
  return existing ?? (await prisma.settings.create({ data: { id: "singleton" } }));
}

export async function updateSettings(data: {
  restaurantName?: string;
  wifiSsid?: string | null;
  wifiPassword?: string | null;
  orderingPaused?: boolean;
}) {
  return prisma.settings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });
}

// ---- メニュー -------------------------------------------------------------

// 予約された価格改定（pendingPrice/applyAt）のうち、適用日を過ぎたものを
// price に反映してクリアする。バックグラウンドジョブを持たない構成のため、
// メニューを読み込むたびにその場で遅延適用する。
//
// 事前に別クエリで対象を探してから1件ずつUPDATEする、という素朴な実装は
// メニュー取得のたびに余分なDB往復（往復1回あたり数百ms〜のレイテンシがある）
// を積み重ねてしまい、体感速度を悪化させていた。ここでは既に取得済みの
// カテゴリ一覧に対してJS側で価格を差し替えて即座に返し、DBへの反映は
// await せずバックグラウンドで行う（レスポンスを待たせない）。
function applyScheduledPricesInPlace<
  T extends { menuItems: { price: number; pendingPrice: number | null; applyAt: Date | null; id: string }[] },
>(categories: T[]): T[] {
  const now = Date.now();
  const toPersist: { id: string; price: number }[] = [];
  for (const category of categories) {
    for (const item of category.menuItems) {
      if (item.applyAt && item.applyAt.getTime() <= now && item.pendingPrice != null) {
        item.price = item.pendingPrice;
        toPersist.push({ id: item.id, price: item.pendingPrice });
      }
    }
  }
  if (toPersist.length > 0) {
    Promise.all(
      toPersist.map(({ id, price }) =>
        prisma.menuItem.update({ where: { id }, data: { price, pendingPrice: null, applyAt: null } })
      )
    ).catch((err) => console.error("Failed to persist scheduled menu price", err));
  }
  return categories;
}

// 客側に見せてよいフィールドだけを残す。pendingPrice/applyAt（未公開の価格改定
// 予定）やstockCount（正確な残数）、categoryId/sortOrder/createdAtのような内部
// 管理用の値は、staffUser以外には一切渡さない。
function toPublicMenuItem(item: {
  id: string;
  name: string;
  price: number;
  description: string | null;
  isRecommended: boolean;
  allergens: string | null;
  imageUrl: string | null;
}) {
  return {
    id: item.id,
    name: item.name,
    price: item.price,
    description: item.description,
    isRecommended: item.isRecommended,
    allergens: item.allergens,
    imageUrl: item.imageUrl,
  };
}

// 客側の注文画面用（販売中の商品のみ、公開してよいフィールドのみ）
export async function getMenu() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      menuItems: {
        where: { isAvailable: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  const applied = applyScheduledPricesInPlace(categories);
  return applied.map((category) => ({
    id: category.id,
    name: category.name,
    menuItems: category.menuItems.map(toPublicMenuItem),
  }));
}

// 設定画面用（販売停止中の商品も含む）
export async function getAllCategoriesWithItems() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { menuItems: { orderBy: { sortOrder: "asc" } } },
  });
  return applyScheduledPricesInPlace(categories);
}

export async function createCategory(name: string) {
  const max = await prisma.category.aggregate({ _max: { sortOrder: true } });
  return prisma.category.create({ data: { name, sortOrder: (max._max.sortOrder ?? -1) + 1 } });
}

export async function renameCategory(id: string, name: string) {
  return prisma.category.update({ where: { id }, data: { name } });
}

export async function deleteCategory(id: string) {
  const count = await prisma.menuItem.count({ where: { categoryId: id } });
  if (count > 0) throw new Error("商品が残っているカテゴリーは削除できません。先に商品を削除・移動してください");
  return prisma.category.delete({ where: { id } });
}

export async function createMenuItem(input: {
  categoryId: string;
  name: string;
  price: number;
  description?: string;
  isRecommended?: boolean;
  allergens?: string;
  imageUrl?: string;
  stockCount?: number | null;
}) {
  const max = await prisma.menuItem.aggregate({
    where: { categoryId: input.categoryId },
    _max: { sortOrder: true },
  });
  return prisma.menuItem.create({
    data: { ...input, sortOrder: (max._max.sortOrder ?? -1) + 1 },
  });
}

export async function updateMenuItem(
  id: string,
  data: Partial<{
    name: string;
    price: number;
    description: string | null;
    isRecommended: boolean;
    isAvailable: boolean;
    categoryId: string;
    allergens: string | null;
    pendingPrice: number | null;
    applyAt: Date | null;
    imageUrl: string | null;
    stockCount: number | null;
  }>
) {
  return prisma.menuItem.update({ where: { id }, data });
}

export async function deleteMenuItem(id: string) {
  const used = await prisma.orderItem.count({ where: { menuItemId: id } });
  if (used > 0) throw new Error("注文履歴がある商品は削除できません。「販売停止」を使ってください");
  return prisma.menuItem.delete({ where: { id } });
}

// ---- 設置場所（QR設置先の提携店舗） ------------------------------------------

export async function listLocations() {
  return prisma.location.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function getLocationById(id: string) {
  return prisma.location.findUnique({ where: { id } });
}

export async function createLocation(name: string) {
  const max = await prisma.location.aggregate({ _max: { sortOrder: true } });
  return prisma.location.create({ data: { name, sortOrder: (max._max.sortOrder ?? -1) + 1 } });
}

export async function renameLocation(id: string, name: string) {
  return prisma.location.update({ where: { id }, data: { name } });
}

export async function setLocationPaused(id: string, isPaused: boolean) {
  return prisma.location.update({ where: { id }, data: { isPaused } });
}

export async function deleteLocation(id: string) {
  const count = await prisma.order.count({ where: { locationId: id } });
  if (count > 0) throw new Error("注文履歴がある設置場所は削除できません");
  return prisma.location.delete({ where: { id } });
}

// ---- 客側: 注文 -----------------------------------------------------------

export async function createOrder(input: {
  items: { menuItemId: string; quantity: number }[];
  note?: string;
  idempotencyKey?: string;
  locationId?: string;
}) {
  // 冪等キーが指定されていて、すでに同じキーの注文が存在するなら新規作成せず
  // それをそのまま返す。通信不安定でクライアントが同じ送信を自動的にやり直した
  // ときに、注文が二重に作られるのを防ぐためのもの。
  if (input.idempotencyKey) {
    const existing = await prisma.order.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { items: true },
    });
    if (existing) return existing;
  }

  if (input.items.length === 0) throw new Error("注文する商品がありません");

  // 受付一時停止中は新規注文を拒否する。客側の画面（/order）はこのフラグを
  // 見て注文画面自体を出さないが、それはUI側のガードに過ぎないため、
  // 一時停止をタップする前に開いていたタブや直接のAPI呼び出しからの
  // 注文を防ぐには、ここでも同じチェックが必要（多層防御）。
  const [settings, orderLocation] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "singleton" } }),
    input.locationId ? prisma.location.findUnique({ where: { id: input.locationId } }) : Promise.resolve(null),
  ]);
  if (settings?.orderingPaused || orderLocation?.isPaused) {
    throw new Error("ただいま注文受付を停止しています");
  }

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: input.items.map((i) => i.menuItemId) }, isAvailable: true },
  });
  const menuItemById = new Map(menuItems.map((m) => [m.id, m]));
  const itemsCreateData = input.items.map(({ menuItemId, quantity }) => {
    const menuItem = menuItemById.get(menuItemId);
    if (!menuItem) throw new Error("商品が見つかりません");
    if (quantity < 1) throw new Error("数量が不正です");
    return { menuItemId, name: menuItem.name, price: menuItem.price, quantity };
  });

  // 残数管理（stockCount）している商品だけ、注文と同じトランザクションで
  // 在庫を減らす。gte条件付きのupdateManyで「注文数以上の在庫が残っている
  // 場合だけ」減算するため、同時に複数人が最後の1点を注文しても二重に
  // 売れることはない（countが0なら在庫不足として弾く）。
  const stockTrackedItems = input.items.filter(({ menuItemId }) => menuItemById.get(menuItemId)?.stockCount != null);

  async function createWithIdempotency(data: {
    locationId?: string;
    note?: string;
    idempotencyKey?: string;
    items: { create: { menuItemId: string; name: string; price: number; quantity: number }[] };
  }) {
    try {
      return await prisma.$transaction(async (tx) => {
        for (const { menuItemId, quantity } of stockTrackedItems) {
          const result = await tx.menuItem.updateMany({
            where: { id: menuItemId, stockCount: { gte: quantity } },
            data: { stockCount: { decrement: quantity } },
          });
          if (result.count === 0) {
            throw new Error(`${menuItemById.get(menuItemId)?.name ?? "商品"}の在庫が不足しています`);
          }
        }
        if (stockTrackedItems.length > 0) {
          await tx.menuItem.updateMany({
            where: { id: { in: stockTrackedItems.map((i) => i.menuItemId) }, stockCount: { lte: 0 } },
            data: { isAvailable: false },
          });
        }
        // 在庫チェックを通過した注文だけ番号を採番する（このトランザクション内で
        // 行うことで、在庫不足で失敗した注文のぶんだけ番号が欠番になるのを防ぐ）。
        const dateKey = getJSTDateKey();
        const counter = await tx.orderCounter.upsert({
          where: { dateKey },
          create: { dateKey, count: 1 },
          update: { count: { increment: 1 } },
        });
        return tx.order.create({ data: { ...data, dailyNumber: counter.count }, include: { items: true } });
      });
    } catch (error) {
      // 冪等キーの競合（ほぼ同時に同じキーで2回送信された）なら、先に作られた
      // ほうを読み直して返す。
      if (input.idempotencyKey && isUniqueConstraintError(error)) {
        const existing = await prisma.order.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: { items: true },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  // 設置場所のQRが古くなって既に削除済みのidを指していても、注文自体は
  // ブロックしない（locationIdを付けずに通常の共通QR注文として扱う）。
  const locationId = orderLocation?.id;

  return createWithIdempotency({
    locationId,
    note: input.note,
    idempotencyKey: input.idempotencyKey,
    items: { create: itemsCreateData },
  });
}

export async function getOrderById(id: string) {
  return prisma.order.findUnique({ where: { id }, include: { items: true, location: { select: { name: true } } } });
}

export async function subscribeOrderPush(orderId: string, subscription: PushSubscriptionData) {
  await prisma.order.update({
    where: { id: orderId },
    data: { pushSubscription: subscription as unknown as Prisma.InputJsonValue },
  });
}

// 待ち時間の目安。件数から単純に見積もるだけで、実際の調理能力は加味しない
// （厳密さより「だいたいの目安」を客に示すことを優先する）。
const MINUTES_PER_ACTIVE_ORDER = 4;

export async function getQueueInfo(order: { dailyNumber: number; status: string }) {
  if (order.status !== "pending" && order.status !== "preparing") {
    return { aheadCount: 0, estimatedMinutes: 0 };
  }
  const { start, end } = getTodayRangeJST();
  const aheadCount = await prisma.order.count({
    where: {
      status: { in: ["pending", "preparing"] },
      dailyNumber: { lt: order.dailyNumber },
      createdAt: { gte: start, lt: end },
    },
  });
  return { aheadCount, estimatedMinutes: (aheadCount + 1) * MINUTES_PER_ACTIVE_ORDER };
}

// ---- 店舗側: 注文管理 --------------------------------------------------------

export async function getKitchenOrders() {
  const orders = await prisma.order.findMany({
    where: { status: { in: ["pending", "preparing"] } },
    orderBy: { dailyNumber: "asc" },
    include: { items: true, location: { select: { name: true } } },
  });
  return { orders };
}

const STATUS_PUSH_MESSAGE: Partial<Record<OrderStatus, string>> = {
  preparing: "ご注文の調理を始めました",
  served: "ご注文の準備ができました。お受け取りください",
  cancelled: "ご注文が取り消されました",
};

export async function updateOrderStatus(orderId: string, status: OrderStatus, cancelReason?: string) {
  const before = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      dailyNumber: true,
      pushSubscription: true,
      items: { select: { menuItemId: true, quantity: true } },
    },
  });

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status, cancelReason: status === "cancelled" ? (cancelReason ?? null) : undefined },
  });

  if (!before || before.status === status) return updated;

  // 取消になった時だけ、残数管理している商品の在庫を戻す（再び注文できるように
  // isAvailableも戻す）。
  if (status === "cancelled") {
    for (const item of before.items) {
      await prisma.menuItem.updateMany({
        where: { id: item.menuItemId, stockCount: { not: null } },
        data: { stockCount: { increment: item.quantity }, isAvailable: true },
      });
    }
  }

  // 客が通知を許可していれば、ステータス変化を知らせる。
  const message = STATUS_PUSH_MESSAGE[status];
  if (message && before.pushSubscription) {
    const { expired } = await sendPushNotification(before.pushSubscription as unknown as PushSubscriptionData, {
      title: `注文 #${before.dailyNumber}`,
      body: message,
    });
    if (expired) {
      await prisma.order.update({ where: { id: orderId }, data: { pushSubscription: Prisma.DbNull } }).catch(() => {});
    }
  }

  return updated;
}

export async function rateOrder(orderId: string, rating: number) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error("評価は1〜5で指定してください");
  return prisma.order.update({ where: { id: orderId }, data: { rating } });
}

// ---- 店舗側: 売上ダッシュボード ---------------------------------------------

export async function getDashboardSummary() {
  const { start, end } = getTodayRangeJST();

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: start, lt: end } },
    // 金額の集計だけに使うため、表示用の名前などを持つ全カラムのitemsは不要。
    select: { status: true, createdAt: true, items: { select: { price: true, quantity: true } } },
  });

  let confirmedAmount = 0;
  let pendingAmount = 0;
  let cancelledCount = 0;
  let orderCount = 0;
  let servedCount = 0;

  const hourly = new Map<number, { lunch: number; dinner: number }>();

  for (const order of orders) {
    const total = itemsTotal(order.items);
    if (order.status === "cancelled") {
      cancelledCount++;
      continue;
    }
    orderCount++;
    if (order.status === "served") {
      confirmedAmount += total;
      servedCount++;
    } else {
      pendingAmount += total;
    }

    const jstHour = new Date(order.createdAt.getTime() + 9 * 60 * 60 * 1000).getUTCHours();
    const bucket = hourly.get(jstHour) ?? { lunch: 0, dinner: 0 };
    if (isLunchHour(order.createdAt)) bucket.lunch += total;
    else bucket.dinner += total;
    hourly.set(jstHour, bucket);
  }

  const totalToday = confirmedAmount + pendingAmount;
  const avgOrderValue = orderCount > 0 ? Math.round(totalToday / orderCount) : 0;

  const hourlyBreakdown = Array.from(hourly.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, v]) => ({ hour, ...v }));

  const lunchTotal = hourlyBreakdown.reduce((s, h) => s + h.lunch, 0);
  const dinnerTotal = hourlyBreakdown.reduce((s, h) => s + h.dinner, 0);

  return {
    totalToday,
    confirmedAmount,
    pendingAmount,
    orderCount,
    avgOrderValue,
    cancelledCount,
    servedCount,
    hourlyBreakdown,
    lunchTotal,
    dinnerTotal,
  };
}

// ---- スタッフアカウント -----------------------------------------------------

export async function listStaffAccounts() {
  return prisma.staffUser.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, createdAt: true },
  });
}

export async function createStaffAccount(email: string, name: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.staffUser.create({
    data: { email: email.trim().toLowerCase(), name, passwordHash },
  });
}

// ---- 招待コード -----------------------------------------------------------
// URLさえ知っていれば誰でも新規登録できてしまう問題への対策。既存スタッフが
// 発行したコードを新規登録時に消費させ、1回使われたら失効させる。

function generateInviteCode(): string {
  // 見間違えやすい文字（0/O、1/I/l 等）を避けた8文字コード
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

export async function createStaffInvite(note?: string, expiresInDays?: number) {
  const code = generateInviteCode();
  const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;
  return prisma.staffInvite.create({ data: { code, note: note || null, expiresAt } });
}

export async function listStaffInvites() {
  return prisma.staffInvite.findMany({ orderBy: { createdAt: "desc" } });
}

export async function deleteStaffInvite(id: string) {
  return prisma.staffInvite.delete({ where: { id } });
}

// 招待コードの検証・消費とアカウント作成を1つのDBトランザクションにまとめる。
// 以前は別々の呼び出しだったため、アカウント作成だけが失敗した場合
// （メールアドレス重複など）に招待コードだけが消費されてしまい、本来の
// 受信者がそのコードを二度と使えなくなる不具合があった。
export async function registerStaffWithInvite(code: string, email: string, name: string, password: string) {
  const normalizedCode = code.trim().toUpperCase();
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 10);

  return prisma.$transaction(async (tx) => {
    const invite = await tx.staffInvite.findUnique({ where: { code: normalizedCode } });
    if (!invite) throw new Error("招待コードが正しくありません");
    if (invite.usedAt) throw new Error("この招待コードは既に使用されています");
    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
      throw new Error("この招待コードは有効期限が切れています");
    }

    try {
      await tx.staffUser.create({ data: { email: normalizedEmail, name, passwordHash } });
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new Error("このメールアドレスは既に登録されています");
      throw error;
    }

    try {
      await tx.staffInvite.update({
        where: { id: invite.id, usedAt: null },
        data: { usedAt: new Date(), usedByEmail: normalizedEmail },
      });
    } catch {
      // 他のリクエストがほぼ同時にこのコードを消費した場合の競合。アカウント
      // 作成ごとロールバックされるので、招待コードが無駄に消費されることはない。
      throw new Error("この招待コードは既に使用されています");
    }
  });
}

export async function deleteStaffAccount(id: string) {
  const total = await prisma.staffUser.count();
  if (total <= 1) throw new Error("最後の1件のアカウントは削除できません");
  return prisma.staffUser.delete({ where: { id } });
}

export async function resetStaffPassword(id: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.staffUser.update({ where: { id }, data: { passwordHash } });
}

// ---- 注文分析 -----------------------------------------------------------

export type AnalyticsPeriod = "today" | "7d" | "30d";

function getRangeForAnalyticsPeriod(period: AnalyticsPeriod): { start: Date; end: Date } {
  const { start: todayStart, end: todayEnd } = getTodayRangeJST();
  if (period === "today") return { start: todayStart, end: todayEnd };
  const days = period === "7d" ? 7 : 30;
  return { start: new Date(todayStart.getTime() - (days - 1) * 24 * 60 * 60 * 1000), end: todayEnd };
}

export async function getOrderAnalytics(period: AnalyticsPeriod) {
  const { start, end } = getRangeForAnalyticsPeriod(period);

  const [items, orders] = await Promise.all([
    prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: start, lt: end }, status: { not: "cancelled" } } },
      // カテゴリー名以外のmenuItemの全カラム（価格・説明・写真URLなど）は
      // 集計に使わないため取得しない。
      include: { menuItem: { select: { category: { select: { name: true } } } } },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: start, lt: end }, status: { not: "cancelled" } },
      select: { location: { select: { name: true } }, items: { select: { price: true, quantity: true } } },
    }),
  ]);

  const byItem = new Map<string, { name: string; quantity: number; revenue: number }>();
  const byCategory = new Map<string, { name: string; quantity: number; revenue: number }>();
  const byLocation = new Map<string, { name: string; orderCount: number; revenue: number }>();

  for (const item of items) {
    const revenue = item.price * item.quantity;

    const itemBucket = byItem.get(item.menuItemId) ?? { name: item.name, quantity: 0, revenue: 0 };
    itemBucket.quantity += item.quantity;
    itemBucket.revenue += revenue;
    byItem.set(item.menuItemId, itemBucket);

    const categoryName = item.menuItem?.category?.name ?? "その他";
    const categoryBucket = byCategory.get(categoryName) ?? { name: categoryName, quantity: 0, revenue: 0 };
    categoryBucket.quantity += item.quantity;
    categoryBucket.revenue += revenue;
    byCategory.set(categoryName, categoryBucket);
  }

  for (const order of orders) {
    const locationName = order.location?.name ?? "共通QR（設置場所なし）";
    const bucket = byLocation.get(locationName) ?? { name: locationName, orderCount: 0, revenue: 0 };
    bucket.orderCount += 1;
    bucket.revenue += itemsTotal(order.items);
    byLocation.set(locationName, bucket);
  }

  const allItems = Array.from(byItem.values());
  const totalQuantity = allItems.reduce((s, i) => s + i.quantity, 0);
  const totalRevenue = allItems.reduce((s, i) => s + i.revenue, 0);
  const orderCount = orders.length;

  return {
    period,
    orderCount,
    totalQuantity,
    totalRevenue,
    avgItemsPerOrder: orderCount > 0 ? Math.round((totalQuantity / orderCount) * 10) / 10 : 0,
    topItems: allItems.sort((a, b) => b.quantity - a.quantity).slice(0, 10),
    categoryBreakdown: Array.from(byCategory.values()).sort((a, b) => b.revenue - a.revenue),
    locationBreakdown: Array.from(byLocation.values()).sort((a, b) => b.revenue - a.revenue),
  };
}

// ---- 期間分析 -----------------------------------------------------------

export type ReportPeriod = "7d" | "30d" | "90d";

export async function getPeriodAnalysis(period: ReportPeriod) {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const { end } = getTodayRangeJST();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: start, lt: end } },
    // 日別集計にはstatus/createdAtと金額計算用のitemsだけあればよい。
    select: { status: true, createdAt: true, items: { select: { price: true, quantity: true } } },
  });

  const dailyMap = new Map<string, { confirmed: number; pending: number; orderCount: number; cancelledCount: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    dailyMap.set(getJSTDateKey(d), { confirmed: 0, pending: 0, orderCount: 0, cancelledCount: 0 });
  }

  for (const order of orders) {
    const key = getJSTDateKey(order.createdAt);
    const bucket = dailyMap.get(key) ?? { confirmed: 0, pending: 0, orderCount: 0, cancelledCount: 0 };
    if (order.status === "cancelled") {
      bucket.cancelledCount++;
    } else {
      const total = itemsTotal(order.items);
      bucket.orderCount++;
      if (order.status === "served") bucket.confirmed += total;
      else bucket.pending += total;
    }
    dailyMap.set(key, bucket);
  }

  const daily = Array.from(dailyMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, v]) => ({ date, ...v, total: v.confirmed + v.pending }));

  const totalRevenue = daily.reduce((s, d) => s + d.total, 0);
  const totalOrders = daily.reduce((s, d) => s + d.orderCount, 0);
  const totalCancelled = daily.reduce((s, d) => s + d.cancelledCount, 0);

  return {
    period,
    daily,
    totalRevenue,
    totalOrders,
    totalCancelled,
    avgOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
  };
}
