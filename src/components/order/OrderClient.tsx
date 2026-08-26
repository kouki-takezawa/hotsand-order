"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ALLERGEN_LABEL, formatYen, formatTime, ORDER_STATUS_LABEL } from "@/lib/format";

interface MenuItemDTO {
  id: string;
  name: string;
  price: number;
  description: string | null;
  isRecommended: boolean;
  allergens: string | null;
  imageUrl: string | null;
}

function allergenLabels(allergens: string | null): string[] {
  if (!allergens) return [];
  return allergens
    .split(",")
    .map((code) => ALLERGEN_LABEL[code as keyof typeof ALLERGEN_LABEL])
    .filter((label): label is string => Boolean(label));
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
  createdAt: string;
  items: OrderItemDTO[];
  total: number;
  rating: number | null;
}

const RATABLE_STATUSES = ["served", "paid"];

export function OrderClient({
  restaurantName,
  tableNumber,
  tableToken,
  tableName,
  categories,
  wifiSsid,
  wifiPassword,
}: {
  restaurantName: string;
  tableNumber: number;
  tableToken: string;
  tableName: string;
  categories: CategoryDTO[];
  wifiSsid?: string | null;
  wifiPassword?: string | null;
}) {
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? "");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showStatus, setShowStatus] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [showWifi, setShowWifi] = useState(false);
  const [splitCount, setSplitCount] = useState("");
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  // このセッションが会計済みになったら true のまま固定する（次に別のお客様が
  // 同じ卓で新しいセッションを始めても、この画面が勝手に注文再開できてしまう
  // と会計後の注文が新しい客のセッションに紛れ込みかねないため、ページを
  // 再読み込みしない限り解除しない）。
  const [sessionClosed, setSessionClosed] = useState(false);
  const [callingStaff, setCallingStaff] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const allItems = useMemo(() => new Map(categories.flatMap((c) => c.menuItems.map((i) => [i.id, i] as const))), [categories]);
  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? categories[0];

  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);
  const cartTotal = Object.entries(cart).reduce((s, [id, q]) => s + (allItems.get(id)?.price ?? 0) * q, 0);

  const validOrders = orders.filter((o) => o.status !== "cancelled");
  const orderedTotal = validOrders.reduce((s, o) => s + o.total, 0);

  async function refreshOrders() {
    try {
      const res = await fetch(`/api/orders/table/${tableNumber}?t=${encodeURIComponent(tableToken)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setOrders(data.orders ?? []);
      if (data.sessionClosed) {
        setSessionClosed(true);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    } catch {
      // ネットワーク一時エラーは無視して次のポーリングに任せる
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初回表示を待たず即取得したい
    refreshOrders();
    pollRef.current = setInterval(refreshOrders, 8000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableNumber]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // 注文明細（OrderItem）はスナップショットのため商品IDを持たず、名前で突き合わせる。
  // 価格改定があっても再注文自体はできるよう、現行メニューに同名の商品があれば追加する。
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
    setShowStatus(false);
    setToast(skipped.length > 0 ? `${skipped.join("・")}は現在ご注文いただけません` : "カートに追加しました");
  }

  function updateQty(itemId: string, delta: number) {
    setCart((prev) => {
      const next = Math.max(0, (prev[itemId] ?? 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[itemId];
      else copy[itemId] = next;
      return copy;
    });
  }

  async function submitOrder() {
    if (cartCount === 0 || submitting || sessionClosed) return;
    setSubmitting(true);
    try {
      const items = Object.entries(cart).map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableNumber, tableToken, items, idempotencyKey }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "注文に失敗しました");
      }
      setCart({});
      setToast("注文を受け付けました");
      refreshOrders();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "注文に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function callStaffNow() {
    if (callingStaff) return;
    setCallingStaff(true);
    try {
      const res = await fetch(`/api/orders/table/${tableNumber}/call-staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tableToken }),
      });
      if (!res.ok) throw new Error();
      setToast("スタッフに連絡しました");
    } catch {
      setToast("呼び出しに失敗しました。もう一度お試しください");
    } finally {
      setCallingStaff(false);
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

  if (sessionClosed) {
    return (
      <div className="flex min-h-screen flex-col items-center bg-background px-6 py-10">
        <p className="text-xs text-muted">{restaurantName}</p>
        <p className="mt-6 text-sm text-muted">{tableName}</p>
        <p className="mt-2 max-w-sm text-center text-2xl font-black text-foreground">お会計ありがとうございました</p>

        {validOrders.length > 0 && (
          <div className="mt-8 w-full max-w-sm rounded-2xl border border-border bg-surface p-4">
            <ul className="space-y-1 text-sm text-foreground">
              {validOrders.flatMap((order) =>
                order.items.map((item) => (
                  <li key={item.id} className="flex justify-between">
                    <span>
                      {item.name} × {item.quantity}
                    </span>
                    <span>{formatYen(item.price * item.quantity)}</span>
                  </li>
                ))
              )}
            </ul>
            <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm font-bold text-foreground">
              <span>合計</span>
              <span>{formatYen(orderedTotal)}</span>
            </div>

            <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
              <input
                type="number"
                min={1}
                value={splitCount}
                onChange={(e) => setSplitCount(e.target.value)}
                placeholder="人数"
                className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground"
              />
              <span className="text-xs text-muted">人で割ると</span>
              {Number(splitCount) > 0 && (
                <span className="text-sm font-bold text-foreground">
                  お一人 {formatYen(Math.ceil(orderedTotal / Number(splitCount)))}
                </span>
              )}
            </div>
          </div>
        )}

        <p className="mt-6 max-w-sm text-center text-xs text-muted">
          このお席のご注文は会計が完了しました。追加のご注文がある場合はスタッフまでお声がけください。
        </p>

        <button
          onClick={callStaffNow}
          disabled={callingStaff}
          className="mt-4 rounded-full border border-border px-6 py-2.5 text-sm font-medium text-foreground disabled:opacity-50"
        >
          {callingStaff ? "連絡中…" : "スタッフを呼ぶ"}
        </button>

        {toast && (
          <div className="fixed inset-x-0 bottom-10 z-30 flex justify-center px-4">
            <div className="rounded-full bg-accent px-4 py-2 text-sm text-accent-foreground shadow-lg">{toast}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 pt-4 pb-3 backdrop-blur">
        <div className="min-w-0">
          <p className="text-xs text-muted">{restaurantName}</p>
          <h1 className="truncate text-lg font-bold text-foreground">{tableName}</h1>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={callStaffNow}
            disabled={callingStaff}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-50"
          >
            {callingStaff ? "連絡中…" : "スタッフを呼ぶ"}
          </button>
          {orders.length > 0 && (
            <button
              onClick={() => setShowStatus(true)}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground"
            >
              注文履歴・合計 {formatYen(orderedTotal)}
            </button>
          )}
        </div>
        {wifiSsid && (
          <button onClick={() => setShowWifi((v) => !v)} className="mt-2 text-xs text-muted underline underline-offset-4">
            Wi-Fi: {wifiSsid}
            {showWifi && wifiPassword ? `（パスワード: ${wifiPassword}）` : ""}
          </button>
        )}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryId(cat.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                cat.id === activeCategory?.id
                  ? "bg-accent text-accent-foreground"
                  : "bg-surface text-muted border border-border"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </header>

      <RecommendedBanner categories={categories} onQuickAdd={(id) => { updateQty(id, 1); setToast("カートに追加しました"); }} />

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

      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-30 flex justify-center px-4">
          <div className="rounded-full bg-accent px-4 py-2 text-sm text-accent-foreground shadow-lg">{toast}</div>
        </div>
      )}

      {showStatus && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={() => setShowStatus(false)}>
          <div
            className="max-h-[75vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">注文履歴</h2>
              <button onClick={() => setShowStatus(false)} className="text-sm text-muted">
                閉じる
              </button>
            </div>
            <div className="space-y-3">
              {orders.length === 0 && <p className="text-sm text-muted">まだ注文はありません</p>}
              {orders.map((order) => {
                const cancelled = order.status === "cancelled";
                return (
                  <div key={order.id} className={`rounded-xl border border-border p-3 ${cancelled ? "opacity-50" : ""}`}>
                    <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
                      <span>{formatTime(new Date(order.createdAt))}</span>
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
                    {RATABLE_STATUSES.includes(order.status) && (
                      <StarRating value={order.rating} onRate={(r) => rateOrder(order.id, r)} />
                    )}
                    {!cancelled && (
                      <button
                        onClick={() => reorderFrom(order)}
                        className="mt-2 text-xs text-muted underline underline-offset-4"
                      >
                        もう一度頼む
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {orders.length > 0 && (
              <>
                <div className="mt-4 flex justify-between border-t border-border pt-3 text-base font-bold text-foreground">
                  <span>合計</span>
                  <span>{formatYen(orderedTotal)}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={splitCount}
                    onChange={(e) => setSplitCount(e.target.value)}
                    placeholder="人数"
                    className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground"
                  />
                  <span className="text-xs text-muted">人で割ると</span>
                  {Number(splitCount) > 0 && (
                    <span className="text-sm font-bold text-foreground">
                      お一人 {formatYen(Math.ceil(orderedTotal / Number(splitCount)))}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function RecommendedBanner({
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

export function StarRating({ value, onRate }: { value: number | null; onRate: (rating: number) => void }) {
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
