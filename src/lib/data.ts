import "server-only";
import bcrypt from "bcryptjs";
import { prisma, isUniqueConstraintError } from "./prisma";
import { getTodayRangeJST, isLunchHour, getJSTDateKey } from "./date";
import type { Order, OrderItem } from "@prisma/client";

export const ACTIVE_STATUSES = ["pending", "preparing", "served"] as const;
export type OrderStatus = "pending" | "preparing" | "served" | "paid" | "cancelled";
export type OperationMode = "table" | "number";

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

// ---- 設定 -------------------------------------------------------------

function toOperationMode(value: string): OperationMode {
  return value === "number" ? "number" : "table";
}

export async function getSettings() {
  const existing = await prisma.settings.findUnique({ where: { id: "singleton" } });
  const settings = existing ?? (await prisma.settings.create({ data: { id: "singleton" } }));
  return { ...settings, operationMode: toOperationMode(settings.operationMode) };
}

export async function updateSettings(data: {
  restaurantName?: string;
  operationMode?: OperationMode;
  wifiSsid?: string | null;
  wifiPassword?: string | null;
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

// 客側の注文画面用（販売中の商品のみ）
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
  return applyScheduledPricesInPlace(categories);
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
  }>
) {
  return prisma.menuItem.update({ where: { id }, data });
}

export async function deleteMenuItem(id: string) {
  const used = await prisma.orderItem.count({ where: { menuItemId: id } });
  if (used > 0) throw new Error("注文履歴がある商品は削除できません。「販売停止」を使ってください");
  return prisma.menuItem.delete({ where: { id } });
}

// ---- テーブル（卓方式） ------------------------------------------------------

export async function getTableByNumber(number: number) {
  return prisma.restaurantTable.findUnique({ where: { number } });
}

export async function getTables() {
  return prisma.restaurantTable.findMany({ orderBy: { number: "asc" } });
}

export async function createTable(name?: string) {
  const max = await prisma.restaurantTable.aggregate({ _max: { number: true } });
  const number = (max._max.number ?? 0) + 1;
  return prisma.restaurantTable.create({
    data: { number, name: name?.trim() || `卓${number}`, qrToken: crypto.randomUUID() },
  });
}

export async function renameTable(id: string, name: string) {
  return prisma.restaurantTable.update({ where: { id }, data: { name } });
}

export async function deleteTable(id: string) {
  const count = await prisma.order.count({ where: { tableId: id } });
  if (count > 0) throw new Error("注文履歴がある卓は削除できません");
  await prisma.tableSession.deleteMany({ where: { tableId: id } });
  return prisma.restaurantTable.delete({ where: { id } });
}

// 同じ卓のQRから複数人がほぼ同時に初回注文したとき、素朴な
// 「探して無ければ作る」だと二人とも「無い」と判定して別々のセッションを
// 作ってしまう競合状態が起きる（会計が片方にしか反映されなくなる不具合の元）。
// そこで常に作成をまず試み、DBのユニーク制約（openTableId）違反で弾かれたら
// 「別のリクエストが先にセッションを作った」ということなので、そちらを読み直す。
async function getOrCreateActiveSession(tableId: string) {
  try {
    return await prisma.tableSession.create({ data: { tableId, openTableId: tableId } });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const existing = await prisma.tableSession.findFirst({
      where: { tableId, closedAt: null },
      orderBy: { startedAt: "desc" },
    });
    if (existing) return existing;
    throw error;
  }
}

// ---- 注文番号（フリー席方式） -------------------------------------------------

async function nextDailyOrderNumber(): Promise<number> {
  const dateKey = getJSTDateKey();
  const counter = await prisma.orderCounter.upsert({
    where: { dateKey },
    create: { dateKey, count: 1 },
    update: { count: { increment: 1 } },
  });
  return counter.count;
}

// ---- 客側: 注文 -----------------------------------------------------------

export async function createOrder(input: {
  tableNumber?: number;
  tableToken?: string;
  items: { menuItemId: string; quantity: number }[];
  note?: string;
  idempotencyKey?: string;
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

  async function createWithIdempotency(data: Parameters<typeof prisma.order.create>[0]["data"]) {
    try {
      return await prisma.order.create({ data, include: { items: true } });
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

  // 卓方式・番号方式（フリー席の共通QR）は排他ではなく併用できる。店舗の
  // 運用設定（operationMode）ではなく、リクエストに卓番号があるかどうかで
  // その注文自体の扱いを決める。
  if (input.tableNumber == null) {
    const dailyNumber = await nextDailyOrderNumber();
    return createWithIdempotency({
      mode: "number",
      dailyNumber,
      note: input.note,
      idempotencyKey: input.idempotencyKey,
      items: { create: itemsCreateData },
    });
  }

  const table = await getTableByNumber(input.tableNumber);
  if (!table) throw new Error("卓が見つかりません");
  if (input.tableToken !== table.qrToken) {
    throw new Error("卓の確認に失敗しました。QRコードを読み取り直してください");
  }
  const session = await getOrCreateActiveSession(table.id);

  return createWithIdempotency({
    mode: "table",
    tableId: table.id,
    sessionId: session.id,
    note: input.note,
    idempotencyKey: input.idempotencyKey,
    items: { create: itemsCreateData },
  });
}

// スタッフ側で、口頭・電話などQRを経由しない注文を卓に代理入力する。
// createOrderの卓方式と同じくその卓の進行中セッションに紐づけるだけなので、
// 客側の注文画面（同じセッションの注文を全件表示する）にもそのまま表示される。
export async function createStaffOrder(tableNumber: number, items: { menuItemId: string; quantity: number }[]) {
  if (items.length === 0) throw new Error("注文する商品がありません");

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: items.map((i) => i.menuItemId) }, isAvailable: true },
  });
  const menuItemById = new Map(menuItems.map((m) => [m.id, m]));
  const itemsCreateData = items.map(({ menuItemId, quantity }) => {
    const menuItem = menuItemById.get(menuItemId);
    if (!menuItem) throw new Error("商品が見つかりません");
    if (quantity < 1) throw new Error("数量が不正です");
    return { menuItemId, name: menuItem.name, price: menuItem.price, quantity };
  });

  const table = await getTableByNumber(tableNumber);
  if (!table) throw new Error("卓が見つかりません");
  const session = await getOrCreateActiveSession(table.id);

  return prisma.order.create({
    data: {
      mode: "table",
      tableId: table.id,
      sessionId: session.id,
      note: "スタッフ入力（口頭注文）",
      items: { create: itemsCreateData },
    },
    include: { items: true },
  });
}

// 客側の注文画面用。「今この卓に紐づいている最新のセッション」を会計済みかどうか
// にかかわらず返す（会計直後は closedAt が入った状態で返る）。これにより客側の
// 画面は「会計が終わったこと」を検知して、それ以上の注文を送れないようロックできる。
// あえて「進行中のセッションだけ」に絞らないのは、絞ってしまうと会計直後に
// 該当セッションが見つからなくなり、客の画面には「注文なし」の空の状態にしか
// 見えず、会計済みであることを伝えられなくなるため。
export async function getTableOrderStatus(tableNumber: number, token: string) {
  const table = await getTableByNumber(tableNumber);
  if (!table || token !== table.qrToken) return null;
  const session = await prisma.tableSession.findFirst({
    where: { tableId: table.id },
    orderBy: { startedAt: "desc" },
  });
  if (!session) return { orders: [] as OrderWithItems[], sessionClosed: false };
  const orders = await prisma.order.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
  return { orders, sessionClosed: session.closedAt !== null };
}

export async function getOrderById(id: string) {
  return prisma.order.findUnique({ where: { id }, include: { items: true } });
}

// ---- 店舗側: 注文管理 --------------------------------------------------------

export type KitchenBoard =
  | {
      mode: "table";
      groups: {
        table: { id: string; number: number; name: string | null; helpRequestedAt: Date | null };
        orders: OrderWithItems[];
      }[];
      // 卓方式の店舗でも、共通QR（卓が決まっていない客用）からの注文は
      // どの卓にも属さないため別枠で返す。
      freeOrders: OrderWithItems[];
    }
  | { mode: "number"; orders: OrderWithItems[] };

export async function getKitchenOrders(): Promise<KitchenBoard> {
  const settings = await getSettings();

  if (settings.operationMode === "number") {
    const orders = await prisma.order.findMany({
      where: { mode: "number", status: { in: ["pending", "preparing"] } },
      orderBy: { dailyNumber: "asc" },
      include: { items: true },
    });
    return { mode: "number", orders };
  }

  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { mode: "table", status: { in: [...ACTIVE_STATUSES] } },
        // 共通QRからの注文は番号方式と同じく、受渡（served）まで進んだら
        // 一覧から外れる（卓のように会計待ちで残り続ける概念が無いため）。
        { mode: "number", status: { in: ["pending", "preparing"] } },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: {
      items: true,
      table: { select: { id: true, number: true, name: true, helpRequestedAt: true } },
    },
  });

  const byTable = new Map<
    number,
    { table: { id: string; number: number; name: string | null; helpRequestedAt: Date | null }; orders: typeof orders }
  >();
  const freeOrders: typeof orders = [];
  for (const order of orders) {
    if (order.mode === "table" && order.table) {
      const key = order.table.number;
      if (!byTable.has(key)) byTable.set(key, { table: order.table, orders: [] });
      byTable.get(key)!.orders.push(order);
    } else {
      freeOrders.push(order);
    }
  }
  return {
    mode: "table",
    groups: Array.from(byTable.values()).sort((a, b) => a.table.number - b.table.number),
    freeOrders: freeOrders.sort((a, b) => (a.dailyNumber ?? 0) - (b.dailyNumber ?? 0)),
  };
}

export async function updateOrderStatus(orderId: string, status: OrderStatus, cancelReason?: string) {
  return prisma.order.update({
    where: { id: orderId },
    data: { status, cancelReason: status === "cancelled" ? (cancelReason ?? null) : undefined },
  });
}

export async function rateOrder(orderId: string, rating: number) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error("評価は1〜5で指定してください");
  return prisma.order.update({ where: { id: orderId }, data: { rating } });
}

export async function checkoutTable(tableNumber: number) {
  const table = await getTableByNumber(tableNumber);
  if (!table) throw new Error("卓が見つかりません");

  const session = await prisma.tableSession.findFirst({
    where: { tableId: table.id, closedAt: null },
  });
  if (!session) throw new Error("進行中の会計セッションがありません");

  await prisma.$transaction([
    prisma.order.updateMany({
      where: { sessionId: session.id, status: { in: [...ACTIVE_STATUSES] } },
      data: { status: "paid" },
    }),
    prisma.tableSession.update({ where: { id: session.id }, data: { closedAt: new Date(), openTableId: null } }),
  ]);
}

// 会計取消の猶予時間。誤タップからの復帰用で、これを過ぎると取消できない。
const UNDO_CHECKOUT_WINDOW_MS = 5 * 60 * 1000;

export async function undoCheckout(tableNumber: number) {
  const table = await getTableByNumber(tableNumber);
  if (!table) throw new Error("卓が見つかりません");

  const session = await prisma.tableSession.findFirst({
    where: { tableId: table.id, closedAt: { not: null } },
    orderBy: { closedAt: "desc" },
  });
  if (!session || !session.closedAt) throw new Error("直近に会計した記録がありません");
  if (Date.now() - session.closedAt.getTime() > UNDO_CHECKOUT_WINDOW_MS) {
    throw new Error("会計から時間が経ちすぎているため取り消せません");
  }

  try {
    await prisma.$transaction([
      prisma.order.updateMany({ where: { sessionId: session.id, status: "paid" }, data: { status: "served" } }),
      prisma.tableSession.update({ where: { id: session.id }, data: { closedAt: null, openTableId: table.id } }),
    ]);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("すでに次のご注文が始まっているため取り消せません");
    }
    throw error;
  }
}

// ---- 卓: スタッフ呼び出し ----------------------------------------------------

export async function callStaff(tableNumber: number, token: string) {
  const table = await getTableByNumber(tableNumber);
  if (!table || token !== table.qrToken) throw new Error("卓の確認に失敗しました");
  await prisma.restaurantTable.update({ where: { id: table.id }, data: { helpRequestedAt: new Date() } });
}

export async function resolveHelp(tableNumber: number) {
  const table = await getTableByNumber(tableNumber);
  if (!table) throw new Error("卓が見つかりません");
  await prisma.restaurantTable.update({ where: { id: table.id }, data: { helpRequestedAt: null } });
}

// ---- 卓: メモ ---------------------------------------------------------------

export async function setTableStaffNote(tableNumber: number, note: string) {
  const table = await getTableByNumber(tableNumber);
  if (!table) throw new Error("卓が見つかりません");
  const session = await prisma.tableSession.findFirst({
    where: { tableId: table.id, closedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (!session) throw new Error("進行中のご注文がありません");
  await prisma.tableSession.update({ where: { id: session.id }, data: { staffNote: note || null } });
}

// ---- 卓: フロアビュー ---------------------------------------------------------

export type FloorTableStatus = "empty" | "active" | "just_closed";

// 卓ごとにセッション・注文を1件ずつ問い合わせる素朴な実装（N+1）は、卓数が
// 増えるほどポーリング（8秒ごと）のたびのDB往復が線形に増えて重くなっていた。
// ここでは全卓分をまとめて3クエリで取得し、JS側でtableIdごとに振り分ける。
export async function getFloorStatus() {
  const tables = await getTables();
  if (tables.length === 0) return [];
  const tableIds = tables.map((t) => t.id);
  const now = Date.now();
  const justClosedSince = new Date(now - UNDO_CHECKOUT_WINDOW_MS);

  const [openSessions, recentClosedSessions, activeOrders] = await Promise.all([
    // openTableIdのユニーク制約により、1卓につき進行中のセッションは高々1件。
    prisma.tableSession.findMany({
      where: { tableId: { in: tableIds }, closedAt: null },
      select: { id: true, tableId: true, staffNote: true },
    }),
    // 会計取消の猶予時間内に閉じたセッションだけを対象にする（それより古い
    // 履歴は「卓の状況」に不要なため取得しない）。
    prisma.tableSession.findMany({
      where: { tableId: { in: tableIds }, closedAt: { gte: justClosedSince } },
      select: { tableId: true, closedAt: true },
    }),
    prisma.order.findMany({
      where: { tableId: { in: tableIds }, status: { in: [...ACTIVE_STATUSES] } },
      select: {
        tableId: true,
        sessionId: true,
        createdAt: true,
        items: { select: { price: true, quantity: true } },
      },
    }),
  ]);

  const openSessionByTable = new Map(openSessions.map((s) => [s.tableId, s]));

  const lastClosedByTable = new Map<string, Date>();
  for (const s of recentClosedSessions) {
    if (!s.closedAt) continue;
    const current = lastClosedByTable.get(s.tableId);
    if (!current || s.closedAt > current) lastClosedByTable.set(s.tableId, s.closedAt);
  }

  const ordersByTable = new Map<string, typeof activeOrders>();
  for (const order of activeOrders) {
    if (!order.tableId) continue;
    const list = ordersByTable.get(order.tableId);
    if (list) list.push(order);
    else ordersByTable.set(order.tableId, [order]);
  }

  return tables.map((table) => {
    const openSession = openSessionByTable.get(table.id);
    const tableOrders = ordersByTable.get(table.id) ?? [];

    let status: FloorTableStatus = "empty";
    let canUndoCheckout = false;
    let subtotal = 0;

    if (openSession) {
      status = "active";
      subtotal = tableOrders
        .filter((o) => o.sessionId === openSession.id)
        .reduce((s, o) => s + itemsTotal(o.items), 0);
    } else {
      const closedAt = lastClosedByTable.get(table.id);
      if (closedAt) {
        status = "just_closed";
        canUndoCheckout = true;
      }
    }

    const lastOrderAt = tableOrders.reduce<Date | null>(
      (max, o) => (!max || o.createdAt > max ? o.createdAt : max),
      null
    );

    return {
      table: { id: table.id, number: table.number, name: table.name },
      status,
      subtotal,
      staffNote: openSession?.staffNote ?? null,
      helpRequestedAt: table.helpRequestedAt,
      lastOrderAt,
      canUndoCheckout,
    };
  });
}

export async function getTodaySessionsForTable(tableNumber: number) {
  const table = await getTableByNumber(tableNumber);
  if (!table) return [];
  const { start, end } = getTodayRangeJST();
  const sessions = await prisma.tableSession.findMany({
    where: { tableId: table.id, startedAt: { gte: start, lt: end } },
    orderBy: { startedAt: "desc" },
    include: {
      orders: { select: { status: true, items: { select: { price: true, quantity: true } } } },
    },
  });
  return sessions.map((s) => ({
    id: s.id,
    startedAt: s.startedAt,
    closedAt: s.closedAt,
    total: s.orders.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + itemsTotal(o.items), 0),
  }));
}

// ---- 店舗側: 売上ダッシュボード ---------------------------------------------

export async function getDashboardSummary() {
  const settings = await getSettings();
  const { start, end } = getTodayRangeJST();

  // 卓方式・番号方式（共通QR）は併用され得るため、店舗の主運用形態に
  // 関わらず本日の全注文を対象にする。確定/未確定の境目（会計 or 受渡）は
  // その注文自体のmodeで判定する。
  const [orders, closedSessions] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: start, lt: end } },
      // 金額の集計だけに使うため、表示用の名前などを持つ全カラムのitemsは不要。
      select: { mode: true, status: true, createdAt: true, items: { select: { price: true, quantity: true } } },
    }),
    settings.operationMode === "table"
      ? prisma.tableSession.count({ where: { closedAt: { gte: start, lt: end } } })
      : Promise.resolve(undefined),
  ]);

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
    const confirmedStatus: OrderStatus = order.mode === "table" ? "paid" : "served";
    if (order.status === confirmedStatus) {
      confirmedAmount += total;
      if (order.mode === "number") servedCount++;
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
    mode: settings.operationMode,
    totalToday,
    confirmedAmount,
    pendingAmount,
    orderCount,
    avgOrderValue,
    cancelledCount,
    checkoutTableCount: closedSessions,
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

// コードを検証し、有効なら即座に使用済みにする（同じコードの二重使用を防ぐため、
// 検証と消費を1つの操作にまとめる）。
export async function consumeStaffInvite(code: string, usedByEmail: string) {
  const normalized = code.trim().toUpperCase();
  const invite = await prisma.staffInvite.findUnique({ where: { code: normalized } });
  if (!invite) throw new Error("招待コードが正しくありません");
  if (invite.usedAt) throw new Error("この招待コードは既に使用されています");
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) throw new Error("この招待コードは有効期限が切れています");

  try {
    await prisma.staffInvite.update({
      where: { id: invite.id, usedAt: null },
      data: { usedAt: new Date(), usedByEmail },
    });
  } catch {
    // 他のリクエストがほぼ同時にこのコードを消費した場合の競合
    throw new Error("この招待コードは既に使用されています");
  }
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

// 卓方式・番号方式（共通QR）は併用され得るため、両方の注文を対象にする。
export async function getOrderAnalytics(period: AnalyticsPeriod) {
  const { start, end } = getRangeForAnalyticsPeriod(period);

  const [items, orderCount] = await Promise.all([
    prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: start, lt: end }, status: { not: "cancelled" } } },
      // カテゴリー名以外のmenuItemの全カラム（価格・説明・写真URLなど）は
      // 集計に使わないため取得しない。
      include: { menuItem: { select: { category: { select: { name: true } } } } },
    }),
    prisma.order.count({
      where: { createdAt: { gte: start, lt: end }, status: { not: "cancelled" } },
    }),
  ]);

  const byItem = new Map<string, { name: string; quantity: number; revenue: number }>();
  const byCategory = new Map<string, { name: string; quantity: number; revenue: number }>();

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

  const allItems = Array.from(byItem.values());
  const totalQuantity = allItems.reduce((s, i) => s + i.quantity, 0);
  const totalRevenue = allItems.reduce((s, i) => s + i.revenue, 0);

  return {
    period,
    orderCount,
    totalQuantity,
    totalRevenue,
    avgItemsPerOrder: orderCount > 0 ? Math.round((totalQuantity / orderCount) * 10) / 10 : 0,
    topItems: allItems.sort((a, b) => b.quantity - a.quantity).slice(0, 10),
    categoryBreakdown: Array.from(byCategory.values()).sort((a, b) => b.revenue - a.revenue),
  };
}

// ---- 期間分析 -----------------------------------------------------------

export type ReportPeriod = "7d" | "30d" | "90d";

export async function getPeriodAnalysis(period: ReportPeriod) {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const { end } = getTodayRangeJST();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

  // 卓方式・番号方式（共通QR）は併用され得るため、両方の注文を対象にする。
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: start, lt: end } },
    // 日別集計にはmode/status/createdAtと金額計算用のitemsだけあればよい。
    select: { mode: true, status: true, createdAt: true, items: { select: { price: true, quantity: true } } },
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
      const confirmedStatus: OrderStatus = order.mode === "table" ? "paid" : "served";
      if (order.status === confirmedStatus) bucket.confirmed += total;
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
