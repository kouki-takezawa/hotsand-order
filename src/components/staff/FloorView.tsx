"use client";

import { useEffect, useState } from "react";
import { formatTime, formatYen } from "@/lib/format";

interface FloorEntry {
  table: { id: string; number: number; name: string | null };
  status: "empty" | "active" | "just_closed";
  subtotal: number;
  staffNote: string | null;
  helpRequestedAt: string | null;
  lastOrderAt: string | null;
  canUndoCheckout: boolean;
}

interface SessionHistoryEntry {
  id: string;
  startedAt: string;
  closedAt: string | null;
  total: number;
}

interface MenuCategoryDTO {
  id: string;
  name: string;
  menuItems: { id: string; name: string; price: number }[];
}

const STATUS_LABEL: Record<FloorEntry["status"], string> = {
  empty: "空席",
  active: "進行中",
  just_closed: "会計済み",
};

export function FloorView({
  onChanged,
  menuCategories = [],
}: {
  onChanged: () => void;
  menuCategories?: MenuCategoryDTO[];
}) {
  const [floor, setFloor] = useState<FloorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, SessionHistoryEntry[]>>({});
  const [orderModalTable, setOrderModalTable] = useState<{ number: number; label: string } | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/staff/tables/floor", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setFloor(json.floor ?? []);
    } catch {
      // 次のポーリングに任せる
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初回表示を待たず即取得したい
    refresh();
    const interval = setInterval(refresh, 8000);
    return () => clearInterval(interval);
  }, []);

  // 更新後にAPIの結果をもう一度全件取得し直すと体感が遅くなるため、結果が
  // 分かっている変更はローカルの状態にその場で反映する。整合性は次のポーリング
  // （8秒ごと）で保たれる。
  async function undoCheckout(tableNumber: number) {
    setBusyId(`undo-${tableNumber}`);
    try {
      const res = await fetch(`/api/staff/tables/${tableNumber}/undo-checkout`, { method: "POST" });
      if (res.ok) {
        setFloor((prev) =>
          prev.map((e) => (e.table.number === tableNumber ? { ...e, status: "active", canUndoCheckout: false } : e))
        );
        onChanged();
      } else {
        await refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function resolveHelp(tableNumber: number) {
    setBusyId(`help-${tableNumber}`);
    setFloor((prev) => prev.map((e) => (e.table.number === tableNumber ? { ...e, helpRequestedAt: null } : e)));
    try {
      await fetch(`/api/staff/tables/${tableNumber}/resolve-help`, { method: "POST" });
      onChanged();
    } finally {
      setBusyId(null);
    }
  }

  async function saveNote(tableNumber: number, note: string) {
    setBusyId(`note-${tableNumber}`);
    setFloor((prev) => prev.map((e) => (e.table.number === tableNumber ? { ...e, staffNote: note || null } : e)));
    try {
      await fetch(`/api/staff/tables/${tableNumber}/note`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
    } finally {
      setBusyId(null);
    }
  }

  async function submitStaffOrder(tableNumber: number, items: { menuItemId: string; quantity: number }[]) {
    const res = await fetch(`/api/staff/tables/${tableNumber}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (res.ok) {
      await refresh();
      onChanged();
    }
    return res;
  }

  async function toggleHistory(tableId: string, tableNumber: number) {
    if (expanded === tableId) {
      setExpanded(null);
      return;
    }
    setExpanded(tableId);
    if (!history[tableId]) {
      try {
        const res = await fetch(`/api/staff/tables/${tableNumber}/sessions`, { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          setHistory((prev) => ({ ...prev, [tableId]: json.sessions ?? [] }));
        }
      } catch {
        // 開いたままにして、再タップで再取得できるようにする
      }
    }
  }

  if (loading) {
    return <p className="py-10 text-center text-sm text-muted">読み込み中…</p>;
  }

  if (floor.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-10 text-center text-sm text-muted">
        テーブルが登録されていません
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {floor.map((entry) => (
        <TableFloorCard
          key={entry.table.id}
          entry={entry}
          busyId={busyId}
          expanded={expanded === entry.table.id}
          history={history[entry.table.id] ?? []}
          onToggleHistory={() => toggleHistory(entry.table.id, entry.table.number)}
          onUndoCheckout={() => undoCheckout(entry.table.number)}
          onResolveHelp={() => resolveHelp(entry.table.number)}
          onSaveNote={(note) => saveNote(entry.table.number, note)}
          onOpenOrderModal={() =>
            setOrderModalTable({ number: entry.table.number, label: entry.table.name ?? `卓${entry.table.number}` })
          }
          canOrder={menuCategories.length > 0}
        />
      ))}

      {orderModalTable && (
        <StaffOrderModal
          tableLabel={orderModalTable.label}
          categories={menuCategories}
          onClose={() => setOrderModalTable(null)}
          onSubmit={(items) => submitStaffOrder(orderModalTable.number, items)}
        />
      )}
    </div>
  );
}

function StaffOrderModal({
  tableLabel,
  categories,
  onClose,
  onSubmit,
}: {
  tableLabel: string;
  categories: MenuCategoryDTO[];
  onClose: () => void;
  onSubmit: (items: { menuItemId: string; quantity: number }[]) => Promise<Response>;
}) {
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? "");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? categories[0];
  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);

  function updateQty(itemId: string, delta: number) {
    setCart((prev) => {
      const next = Math.max(0, (prev[itemId] ?? 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[itemId];
      else copy[itemId] = next;
      return copy;
    });
  }

  async function submit() {
    if (cartCount === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const items = Object.entries(cart).map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
      const res = await onSubmit(items);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "注文の登録に失敗しました");
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "注文の登録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-base font-bold text-foreground">{tableLabel}に注文を追加</h2>
          <button onClick={onClose} className="text-sm text-muted">
            閉じる
          </button>
        </div>
        <p className="px-4 pt-3 text-xs text-muted">電話・口頭でのご注文をこの卓の会計に代理入力します。</p>

        <div className="flex gap-2 overflow-x-auto px-4 py-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryId(cat.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                cat.id === activeCategory?.id ? "bg-accent text-accent-foreground" : "border border-border text-muted"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="flex-1 divide-y divide-border overflow-y-auto px-4">
          {activeCategory?.menuItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                <p className="text-xs text-muted">{formatYen(item.price)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => updateQty(item.id, -1)}
                  disabled={!cart[item.id]}
                  aria-label="減らす"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-foreground disabled:opacity-30"
                >
                  −
                </button>
                <span className="w-4 text-center text-sm font-medium tabular-nums">{cart[item.id] ?? 0}</span>
                <button
                  onClick={() => updateQty(item.id, 1)}
                  aria-label="増やす"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        {error && <p className="mx-4 mt-2 rounded-lg border border-warning bg-warning-surface px-2.5 py-1.5 text-xs font-medium text-warning">{error}</p>}

        <div className="border-t border-border p-4">
          <button
            onClick={submit}
            disabled={cartCount === 0 || submitting}
            className="w-full rounded-full bg-accent py-3 text-sm font-bold text-accent-foreground disabled:opacity-50"
          >
            {submitting ? "送信中…" : `${cartCount}点を追加する`}
          </button>
        </div>
      </div>
    </div>
  );
}

function TableFloorCard({
  entry,
  busyId,
  expanded,
  history,
  onToggleHistory,
  onUndoCheckout,
  onResolveHelp,
  onSaveNote,
  onOpenOrderModal,
  canOrder,
}: {
  entry: FloorEntry;
  busyId: string | null;
  expanded: boolean;
  history: SessionHistoryEntry[];
  onToggleHistory: () => void;
  onUndoCheckout: () => void;
  onResolveHelp: () => void;
  onSaveNote: (note: string) => void;
  onOpenOrderModal: () => void;
  canOrder: boolean;
}) {
  const { table } = entry;
  const [noteDraft, setNoteDraft] = useState(entry.staffNote ?? "");
  const [editingNote, setEditingNote] = useState(false);
  const noteBusy = busyId === `note-${table.number}`;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-base font-bold text-foreground">{table.name ?? `卓${table.number}`}</h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            entry.status === "active"
              ? "bg-accent text-accent-foreground"
              : entry.status === "just_closed"
                ? "border border-warning text-warning"
                : "border border-border text-muted"
          }`}
        >
          {STATUS_LABEL[entry.status]}
        </span>
      </div>

      {canOrder && (
        <button
          onClick={onOpenOrderModal}
          className="mb-2 w-full rounded-lg border border-dashed border-border px-2.5 py-1.5 text-xs font-medium text-muted"
        >
          ＋ 口頭注文を追加
        </button>
      )}

      {entry.status === "active" && (
        <p className="text-sm text-muted">
          小計 <span className="font-bold text-foreground">{formatYen(entry.subtotal)}</span>
        </p>
      )}
      {entry.lastOrderAt && (
        <p className="mt-0.5 text-xs text-muted">最終注文 {formatTime(new Date(entry.lastOrderAt))}</p>
      )}

      {entry.status === "active" &&
        (editingNote ? (
          <div className="mt-2">
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="アレルギー・記念日など、スタッフ向けのメモ"
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
            />
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => {
                  onSaveNote(noteDraft);
                  setEditingNote(false);
                }}
                disabled={noteBusy}
                className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground disabled:opacity-50"
              >
                保存
              </button>
              <button onClick={() => setEditingNote(false)} className="text-xs text-muted underline underline-offset-4">
                やめる
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setEditingNote(true)}
            className="mt-2 w-full rounded-lg bg-background px-2.5 py-1.5 text-left text-xs text-foreground"
          >
            {entry.staffNote || <span className="text-muted">＋ 卓メモを追加</span>}
          </button>
        ))}

      {entry.helpRequestedAt && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-warning bg-warning-surface px-3 py-1.5 text-xs font-medium text-warning">
          <span>スタッフ呼び出し中</span>
          <button
            onClick={onResolveHelp}
            disabled={busyId === `help-${table.number}`}
            className="underline underline-offset-4 disabled:opacity-50"
          >
            対応済みにする
          </button>
        </div>
      )}

      {entry.canUndoCheckout && (
        <button
          onClick={onUndoCheckout}
          disabled={busyId === `undo-${table.number}`}
          className="mt-3 w-full rounded-full border border-warning py-1.5 text-xs font-medium text-warning disabled:opacity-50"
        >
          会計を取り消す
        </button>
      )}

      <button onClick={onToggleHistory} className="mt-3 text-xs text-muted underline underline-offset-4">
        {expanded ? "本日の履歴を閉じる" : "本日の履歴を見る"}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5 border-t border-border pt-2">
          {history.length === 0 && <p className="text-xs text-muted">本日の記録はまだありません</p>}
          {history.map((s) => (
            <div key={s.id} className="flex justify-between text-xs text-muted">
              <span>
                {formatTime(new Date(s.startedAt))}
                {s.closedAt ? ` 〜 ${formatTime(new Date(s.closedAt))}` : "（進行中）"}
              </span>
              <span className="font-medium text-foreground">{formatYen(s.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
