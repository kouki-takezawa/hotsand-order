"use client";

import { useEffect, useState } from "react";
import { formatYen, ORDER_STATUS_LABEL } from "@/lib/format";

interface OrderItemDTO {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface OrderDTO {
  id: string;
  status: string;
  note: string | null;
  createdAt: string;
  dailyNumber: number | null;
  items: OrderItemDTO[];
  total: number;
}

interface BoardData {
  orders: OrderDTO[];
}

const STATUS_STEPS: { value: string; label: string }[] = [
  { value: "pending", label: "受付" },
  { value: "preparing", label: "調理中" },
  { value: "served", label: "受渡済み" },
];

export function OrdersBoard({ initialData }: { initialData: BoardData }) {
  const [data, setData] = useState<BoardData>(initialData);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/staff/orders", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } catch {
      // 次のポーリングに任せる
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初回表示を待たず即取得したい
    refresh();
    const interval = setInterval(refresh, 6000);
    return () => clearInterval(interval);
  }, []);

  // ステータス更新のたびに「更新→全件再取得」と2回DB往復させると体感が
  // 遅くなるため、更新APIが返す最新の注文をそのままローカルの状態に反映する
  // （残りの整合性は次の定期ポーリングに任せる）。
  function patchOrderInState(updated: { id: string; status: string; cancelReason?: string | null }) {
    setData((prev) => ({ ...prev, orders: prev.orders.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)) }));
  }

  async function updateStatus(orderId: string, status: string, cancelReason?: string) {
    setBusyId(orderId);
    try {
      const res = await fetch(`/api/staff/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, cancelReason }),
      });
      if (res.ok) {
        const { order } = await res.json();
        patchOrderInState(order);
      } else {
        await refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  if (data.orders.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-10 text-center text-sm text-muted">
        現在、進行中の注文はありません
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.orders.map((order) => (
        <OrderCard key={order.id} order={order} busyId={busyId} onUpdateStatus={updateStatus} />
      ))}
    </div>
  );
}

const CANCEL_REASONS: { value: string; label: string }[] = [
  { value: "customer", label: "お客様都合" },
  { value: "kitchen", label: "厨房都合" },
  { value: "out_of_stock", label: "欠品" },
];

function OrderCard({
  order,
  busyId,
  onUpdateStatus,
}: {
  order: OrderDTO;
  busyId: string | null;
  onUpdateStatus: (orderId: string, status: string, cancelReason?: string) => void;
}) {
  const [showCancelPicker, setShowCancelPicker] = useState(false);
  const isFinal = order.status === "cancelled";
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
        <span>#{order.dailyNumber}</span>
        {isFinal && (
          <span className="rounded-full bg-background px-2 py-0.5 font-medium text-foreground">
            {ORDER_STATUS_LABEL[order.status] ?? order.status}
          </span>
        )}
      </div>
      <ul className="mb-2 space-y-0.5 text-sm text-foreground">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between">
            <span>
              {item.name} × {item.quantity}
            </span>
            <span>{formatYen(item.price * item.quantity)}</span>
          </li>
        ))}
      </ul>
      {!isFinal && !showCancelPicker && (
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_STEPS.map((step) => (
            <button
              key={step.value}
              onClick={() => onUpdateStatus(order.id, step.value)}
              disabled={busyId === order.id}
              className={`rounded-full px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                order.status === step.value
                  ? "bg-accent text-accent-foreground"
                  : "border border-border text-muted"
              }`}
            >
              {step.label}
            </button>
          ))}
          <button
            onClick={() => setShowCancelPicker(true)}
            disabled={busyId === order.id}
            className="rounded-full px-2.5 py-1 text-xs font-medium text-warning underline underline-offset-4 disabled:opacity-50"
          >
            取消
          </button>
        </div>
      )}
      {!isFinal && showCancelPicker && (
        <div className="rounded-lg border border-warning bg-warning-surface p-2">
          <p className="mb-1.5 text-xs font-medium text-warning">取消の理由を選んでください</p>
          <div className="flex flex-wrap gap-1.5">
            {CANCEL_REASONS.map((reason) => (
              <button
                key={reason.value}
                onClick={() => {
                  onUpdateStatus(order.id, "cancelled", reason.value);
                  setShowCancelPicker(false);
                }}
                disabled={busyId === order.id}
                className="rounded-full border border-warning px-2.5 py-1 text-xs text-warning disabled:opacity-50"
              >
                {reason.label}
              </button>
            ))}
            <button
              onClick={() => setShowCancelPicker(false)}
              className="rounded-full px-2.5 py-1 text-xs text-muted underline underline-offset-4"
            >
              やめる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
