"use client";

import { useEffect, useMemo, useState } from "react";
import { ALLERGEN_CODES, ALLERGEN_LABEL, formatYen, ORDER_STATUS_LABEL } from "@/lib/format";

interface MenuItemDTO {
  id: string;
  name: string;
  price: number;
  description: string | null;
  isRecommended: boolean;
  allergens: string | null;
  imageUrl: string | null;
}

function allergenCodesOf(allergens: string | null): string[] {
  return allergens ? allergens.split(",").filter(Boolean) : [];
}

function allergenLabels(allergens: string | null): string[] {
  return allergenCodesOf(allergens)
    .map((code) => ALLERGEN_LABEL[code as keyof typeof ALLERGEN_LABEL])
    .filter((label): label is string => Boolean(label));
}

// PushManager.subscribeにはUint8ArrayのapplicationServerKeyが必要なため、
// base64url形式のVAPID公開鍵を変換する。
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

interface CategoryDTO {
  id: string;
  name: string;
  menuItems: MenuItemDTO[];
}

interface OrderItemDTO {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface OrderDTO {
  id: string;
  status: string;
  dailyNumber: number | null;
  items: OrderItemDTO[];
  total: number;
  rating: number | null;
  queue?: { aheadCount: number; estimatedMinutes: number };
}

const STORAGE_KEY = "hotsand-order-ids";
const RATABLE_STATUSES = ["served"];
const TERMINAL_STATUSES = ["served", "cancelled"];

function loadStoredIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function saveStoredIds(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function NumberOrderClient({
  restaurantName,
  categories,
  wifiSsid,
  wifiPassword,
  locationId,
  locationName,
}: {
  restaurantName: string;
  categories: CategoryDTO[];
  wifiSsid?: string | null;
  wifiPassword?: string | null;
  locationId?: string;
  locationName?: string;
}) {
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? "");
  const [showWifi, setShowWifi] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [view, setView] = useState<"menu" | "confirmation">("menu");
  const [showCart, setShowCart] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [showAllergenFilter, setShowAllergenFilter] = useState(false);
  const [excludedAllergens, setExcludedAllergens] = useState<string[]>([]);
  const [pushEnabledOrderIds, setPushEnabledOrderIds] = useState<string[]>([]);
  const [pushStatus, setPushStatus] = useState<"idle" | "requesting" | "denied" | "unsupported">("idle");

  const allItems = useMemo(() => new Map(categories.flatMap((c) => c.menuItems.map((i) => [i.id, i] as const))), [categories]);
  const filteredCategories = useMemo(() => {
    if (excludedAllergens.length === 0) return categories;
    return categories.map((c) => ({
      ...c,
      menuItems: c.menuItems.filter((item) => !allergenCodesOf(item.allergens).some((code) => excludedAllergens.includes(code))),
    }));
  }, [categories, excludedAllergens]);
  const activeCategory = filteredCategories.find((c) => c.id === activeCategoryId) ?? filteredCategories[0];

  function toggleExcludedAllergen(code: string) {
    setExcludedAllergens((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  async function enablePushForOrder(orderId: string) {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushStatus("unsupported");
      return;
    }
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      setPushStatus("unsupported");
      return;
    }
    setPushStatus("requesting");
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushStatus("denied");
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
      await fetch(`/api/orders/${orderId}/push-subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      setPushEnabledOrderIds((prev) => [...prev, orderId]);
      setPushStatus("idle");
    } catch {
      setPushStatus("denied");
    }
  }

  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);
  const cartTotal = Object.entries(cart).reduce((s, [id, q]) => s + (allItems.get(id)?.price ?? 0) * q, 0);

  const validOrders = orders.filter((o) => o.status !== "cancelled");
  const grandTotal = validOrders.reduce((s, o) => s + o.total, 0);
  const latestOrder = orders[orders.length - 1] ?? null;

  async function fetchOrder(id: string): Promise<OrderDTO | null> {
    try {
      const res = await fetch(`/api/orders/${id}`, { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      return data.order ?? null;
    } catch {
      return null;
    }
  }

  // ページを開いたとき、これまでの注文（複数）を復元する
  useEffect(() => {
    const ids = loadStoredIds();
    if (ids.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 復元対象がなければ即座に読み込み中を解除する
      setRestoring(false);
      return;
    }
    Promise.all(ids.map(fetchOrder)).then((results) => {
      const found = results.filter((o): o is OrderDTO => o !== null);
      setOrders(found);
      saveStoredIds(found.map((o) => o.id));
      if (found.length > 0) setView("confirmation");
      setRestoring(false);
    });
  }, []);

  // 進行中の注文があるあいだは、数秒おきに全件の状態を確認する
  useEffect(() => {
    const pendingIds = orders.filter((o) => !TERMINAL_STATUSES.includes(o.status)).map((o) => o.id);
    if (pendingIds.length === 0) return;
    const interval = setInterval(async () => {
      const updates = await Promise.all(pendingIds.map(fetchOrder));
      setOrders((prev) =>
        prev.map((o) => updates.find((u): u is OrderDTO => u !== null && u.id === o.id) ?? o)
      );
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders.map((o) => o.status).join(",")]);

  function updateQty(itemId: string, delta: number) {
    setCart((prev) => {
      const next = Math.max(0, (prev[itemId] ?? 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[itemId];
      else copy[itemId] = next;
      return copy;
    });
  }

  // 注文明細（OrderItem）はスナップショットのため商品IDを持たず、名前で突き合わせる。
  function reorderFrom(order: OrderDTO) {
    const skipped: string[] = [];
    setCart((prev) => {
      const copy = { ...prev };
      for (const item of order.items) {
        const current = categories.flatMap((c) => c.menuItems).find((m) => m.name === item.name);
        if (!current) {
          skipped.push(item.name);
          continue;
        }
        copy[current.id] = (copy[current.id] ?? 0) + item.quantity;
      }
      return copy;
    });
    setShowHistory(false);
    setView("menu");
    setErrorMsg(skipped.length > 0 ? `${skipped.join("・")}は現在ご注文いただけません` : null);
  }

  async function submitOrder() {
    if (cartCount === 0 || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const items = Object.entries(cart).map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, idempotencyKey, locationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "注文に失敗しました");

      const order = data.order;
      const total = order.items.reduce((s: number, i: OrderItemDTO) => s + i.price * i.quantity, 0);
      const orderDto: OrderDTO = { ...order, total };
      setOrders((prev) => {
        const next = [...prev, orderDto];
        saveStoredIds(next.map((o) => o.id));
        return next;
      });
      setCart({});
      setView("confirmation");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "注文に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function rateOrder(orderId: string, rating: number) {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, rating } : o)));
    try {
      await fetch(`/api/orders/${orderId}/rate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
    } catch {
      // 評価は付加的な情報のため、送信に失敗しても次のポーリングで実態と揃う
    }
  }

  if (restoring) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted">読み込み中…</div>;
  }

  if (view === "confirmation" && latestOrder) {
    return (
      <div className="flex min-h-screen flex-col items-center bg-background px-6 py-10">
        <p className="text-xs text-muted">{restaurantName}</p>
        {locationName && <p className="mt-1 text-xs text-muted">受け取り店舗: {locationName}</p>}
        <p className="mt-6 text-sm text-muted">あなたの注文番号</p>
        <p className="mt-1 text-6xl font-black tabular-nums text-foreground">#{latestOrder.dailyNumber}</p>
        <span className="mt-4 rounded-full bg-surface px-4 py-1.5 text-sm font-medium text-foreground">
          {ORDER_STATUS_LABEL[latestOrder.status] ?? latestOrder.status}
        </span>

        {!TERMINAL_STATUSES.includes(latestOrder.status) && latestOrder.queue && (
          <p className="mt-2 text-xs text-muted">
            {latestOrder.queue.aheadCount > 0 ? `あと${latestOrder.queue.aheadCount}件先に並んでいます・` : ""}
            受け取りまで目安 約{latestOrder.queue.estimatedMinutes}分
          </p>
        )}

        {!TERMINAL_STATUSES.includes(latestOrder.status) && !pushEnabledOrderIds.includes(latestOrder.id) && (
          <div className="mt-3">
            {pushStatus === "unsupported" || pushStatus === "denied" ? (
              <p className="text-xs text-muted">
                {pushStatus === "denied" ? "通知が許可されませんでした。" : "この端末では通知に対応していません。"}
                画面を開いたままお待ちください。
              </p>
            ) : (
              <button
                onClick={() => enablePushForOrder(latestOrder.id)}
                disabled={pushStatus === "requesting"}
                className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-foreground disabled:opacity-50"
              >
                {pushStatus === "requesting" ? "設定中…" : "🔔 準備ができたら通知を受け取る"}
              </button>
            )}
          </div>
        )}

        <div className="mt-8 w-full max-w-sm rounded-2xl border border-border bg-surface p-4">
          <ul className="space-y-1 text-sm text-foreground">
            {latestOrder.items.map((item) => (
              <li key={item.id} className="flex justify-between">
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>{formatYen(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm font-bold text-foreground">
            <span>合計</span>
            <span>{formatYen(latestOrder.total)}</span>
          </div>
          {RATABLE_STATUSES.includes(latestOrder.status) && (
            <StarRating value={latestOrder.rating} onRate={(r) => rateOrder(latestOrder.id, r)} />
          )}
        </div>

        <p className="mt-6 max-w-sm text-center text-xs text-muted">
          番号が呼ばれたらお受け取りください。お会計は店舗にてお願いいたします。
        </p>

        {orders.length > 1 && (
          <button
            onClick={() => setShowHistory(true)}
            className="mt-6 text-xs text-muted underline underline-offset-4"
          >
            これまでの注文履歴・合計 {formatYen(grandTotal)}
          </button>
        )}

        <button
          onClick={() => setView("menu")}
          className="mt-8 rounded-full border border-border px-6 py-2.5 text-sm font-medium text-foreground"
        >
          追加で注文する
        </button>

        {showHistory && (
          <HistorySheet orders={orders} grandTotal={grandTotal} onClose={() => setShowHistory(false)} onReorder={reorderFrom} />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 pt-4 pb-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted">{restaurantName}</p>
            <h1 className="text-lg font-bold text-foreground">ご注文</h1>
            {locationName && <p className="text-xs text-muted">{locationName}</p>}
          </div>
          {orders.length > 0 && (
            <button
              onClick={() => setView("confirmation")}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground"
            >
              直前の注文へ戻る
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {wifiSsid && (
            <button onClick={() => setShowWifi((v) => !v)} className="text-xs text-muted underline underline-offset-4">
              Wi-Fi: {wifiSsid}
              {showWifi && wifiPassword ? `（パスワード: ${wifiPassword}）` : ""}
            </button>
          )}
          <button
            onClick={() => setShowAllergenFilter((v) => !v)}
            className="text-xs text-muted underline underline-offset-4"
          >
            アレルギーで絞り込む{excludedAllergens.length > 0 ? `（${excludedAllergens.length}件除外中）` : ""}
          </button>
        </div>
        {showAllergenFilter && (
          <div className="mt-2 flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-2.5">
            {ALLERGEN_CODES.map((code) => (
              <label key={code} className="flex items-center gap-1 text-[11px] text-muted">
                <input
                  type="checkbox"
                  checked={excludedAllergens.includes(code)}
                  onChange={() => toggleExcludedAllergen(code)}
                />
                {ALLERGEN_LABEL[code]}を含まない
              </label>
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {filteredCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryId(cat.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                cat.id === activeCategory?.id ? "bg-accent text-accent-foreground" : "bg-surface text-muted border border-border"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </header>

      <RecommendedBanner categories={filteredCategories} onQuickAdd={(id) => updateQty(id, 1)} />

      <main className="divide-y divide-border px-4">
        {activeCategory?.menuItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 py-4">
            {item.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{item.name}</p>
              {item.description && <p className="mt-0.5 truncate text-xs text-muted">{item.description}</p>}
              <p className="mt-1 text-sm text-muted">{formatYen(item.price)}</p>
              {allergenLabels(item.allergens).length > 0 && (
                <p className="mt-0.5 text-[11px] text-muted">{allergenLabels(item.allergens).join("・")}を含む</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                onClick={() => updateQty(item.id, -1)}
                disabled={!cart[item.id]}
                aria-label="減らす"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground disabled:opacity-30"
              >
                −
              </button>
              <span className="w-4 text-center text-sm font-medium tabular-nums">{cart[item.id] ?? 0}</span>
              <button
                onClick={() => updateQty(item.id, 1)}
                aria-label="増やす"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground"
              >
                +
              </button>
            </div>
          </div>
        ))}
        {!activeCategory?.menuItems.length && (
          <p className="py-10 text-center text-sm text-muted">現在このカテゴリーの商品はありません</p>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface px-4 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button
            onClick={() => setShowCart(true)}
            disabled={cartCount === 0}
            className="text-left disabled:opacity-50"
          >
            <p className="text-xs text-muted underline underline-offset-4">{cartCount}点（内容を確認）</p>
            <p className="text-lg font-bold text-foreground">{formatYen(cartTotal)}</p>
          </button>
          <button
            onClick={submitOrder}
            disabled={cartCount === 0 || submitting}
            className="rounded-full bg-accent px-8 py-3 text-sm font-bold text-accent-foreground disabled:bg-border disabled:text-muted"
          >
            {submitting ? "送信中…" : "注文する"}
          </button>
        </div>
      </div>

      {showCart && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={() => setShowCart(false)}>
          <div
            className="max-h-[75vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">カートの中身</h2>
              <button onClick={() => setShowCart(false)} className="text-sm text-muted">
                閉じる
              </button>
            </div>
            <div className="space-y-3">
              {Object.entries(cart).map(([itemId, qty]) => {
                const item = allItems.get(itemId);
                if (!item) return null;
                return (
                  <div key={itemId} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted">{formatYen(item.price)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <button
                        onClick={() => updateQty(itemId, -1)}
                        aria-label="減らす"
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-foreground"
                      >
                        −
                      </button>
                      <span className="w-4 text-center text-sm font-medium tabular-nums">{qty}</span>
                      <button
                        onClick={() => updateQty(itemId, 1)}
                        aria-label="増やす"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
              {cartCount === 0 && <p className="text-sm text-muted">カートは空です</p>}
            </div>
            {cartCount > 0 && (
              <>
                <div className="mt-4 flex justify-between border-t border-border pt-3 text-base font-bold text-foreground">
                  <span>合計</span>
                  <span>{formatYen(cartTotal)}</span>
                </div>
                <button
                  onClick={() => {
                    setShowCart(false);
                    submitOrder();
                  }}
                  disabled={submitting}
                  className="mt-3 w-full rounded-full bg-accent py-3 text-sm font-bold text-accent-foreground disabled:opacity-50"
                >
                  {submitting ? "送信中…" : "この内容で注文する"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="fixed inset-x-0 bottom-24 z-30 flex justify-center px-4">
          <div className="rounded-full bg-accent px-4 py-2 text-sm text-accent-foreground shadow-lg">{errorMsg}</div>
        </div>
      )}
    </div>
  );
}

function HistorySheet({
  orders,
  grandTotal,
  onClose,
  onReorder,
}: {
  orders: OrderDTO[];
  grandTotal: number;
  onClose: () => void;
  onReorder: (order: OrderDTO) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={onClose}>
      <div className="max-h-[75vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">注文履歴</h2>
          <button onClick={onClose} className="text-sm text-muted">
            閉じる
          </button>
        </div>
        <div className="space-y-3">
          {[...orders].reverse().map((order) => {
            const cancelled = order.status === "cancelled";
            return (
              <div key={order.id} className={`rounded-xl border border-border p-3 ${cancelled ? "opacity-50" : ""}`}>
                <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
                  <span>#{order.dailyNumber}</span>
                  <span className="rounded-full bg-background px-2 py-0.5 font-medium text-foreground">
                    {ORDER_STATUS_LABEL[order.status] ?? order.status}
                  </span>
                </div>
                <ul className={`space-y-0.5 text-sm text-foreground ${cancelled ? "line-through" : ""}`}>
                  {order.items.map((item) => (
                    <li key={item.id} className="flex justify-between">
                      <span>
                        {item.name} × {item.quantity}
                      </span>
                      <span>{formatYen(item.price * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
                {!cancelled && (
                  <button
                    onClick={() => onReorder(order)}
                    className="mt-2 text-xs text-muted underline underline-offset-4"
                  >
                    もう一度頼む
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex justify-between border-t border-border pt-3 text-base font-bold text-foreground">
          <span>合計</span>
          <span>{formatYen(grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}

function RecommendedBanner({
  categories,
  onQuickAdd,
}: {
  categories: CategoryDTO[];
  onQuickAdd: (menuItemId: string) => void;
}) {
  const recommended = categories.flatMap((c) => c.menuItems).filter((i) => i.isRecommended);
  if (recommended.length === 0) return null;
  return (
    <div className="border-b border-border px-4 py-3">
      <p className="mb-2 text-xs font-medium text-muted">おすすめ</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {recommended.map((item) => (
          <button
            key={item.id}
            onClick={() => onQuickAdd(item.id)}
            className="w-28 shrink-0 overflow-hidden rounded-xl border border-border bg-surface text-left"
          >
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt="" className="h-20 w-full object-cover" />
            ) : (
              <div className="h-20 w-full bg-background" />
            )}
            <div className="px-2 py-1.5">
              <p className="truncate text-xs font-medium text-foreground">{item.name}</p>
              <p className="text-[11px] text-muted">{formatYen(item.price)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StarRating({ value, onRate }: { value: number | null; onRate: (rating: number) => void }) {
  if (value) {
    return <p className="mt-1.5 text-xs text-muted">評価: {"★".repeat(value)}{"☆".repeat(5 - value)}</p>;
  }
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <span className="text-xs text-muted">よろしければ評価をお願いします</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onRate(n)}
            aria-label={`${n}つ星`}
            className="text-base text-muted"
          >
            ☆
          </button>
        ))}
      </div>
    </div>
  );
}
