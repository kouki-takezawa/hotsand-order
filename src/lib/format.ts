export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(date);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "新規注文",
  preparing: "調理中",
  served: "受渡済み",
  cancelled: "取消",
};

// 特定原材料8品目（アレルギー表示）。MenuItem.allergensにこのコードを
// カンマ区切りで保持する。
export const ALLERGEN_CODES = ["egg", "milk", "wheat", "shrimp", "crab", "soba", "peanut", "walnut"] as const;

export const ALLERGEN_LABEL: Record<(typeof ALLERGEN_CODES)[number], string> = {
  egg: "卵",
  milk: "乳",
  wheat: "小麦",
  shrimp: "えび",
  crab: "かに",
  soba: "そば",
  peanut: "落花生",
  walnut: "くるみ",
};
