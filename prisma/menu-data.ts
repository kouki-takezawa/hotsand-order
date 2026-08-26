// 現在提供中のメニュー内容。prisma/seed.ts（初回デプロイ時の初期データ投入）と
// prisma/reset-menu.ts（既存メニューをこの内容に一括更新するスクリプト）の両方から
// 参照する、唯一の正（single source of truth）。メニュー内容を変更するときはここを
// 直接編集するのではなく、通常は設定＞メニュー画面から行う。ここを直接編集するのは
// 「メニューが刷新された」など、初期データ・一括更新の基準そのものを変えたいとき。

export interface MenuDataItem {
  name: string;
  price: number;
  description?: string;
  isRecommended?: boolean;
}

export interface MenuDataCategory {
  name: string;
  sortOrder: number;
  items: MenuDataItem[];
}

export const CURRENT_MENU: MenuDataCategory[] = [
  {
    name: "ホットサンド",
    sortOrder: 0,
    items: [
      { name: "ハム&チーズ", price: 550 },
      { name: "ベーコンエッグ", price: 650, isRecommended: true },
      { name: "照り焼きチキン", price: 750, isRecommended: true },
      { name: "チョコバナナ", price: 600 },
    ],
  },
  {
    name: "サイド",
    sortOrder: 1,
    items: [
      { name: "フライドポテト", price: 400 },
      { name: "コールスロー", price: 350 },
      { name: "スープ（本日のスープ）", price: 400 },
      { name: "グリーンサラダ", price: 400 },
    ],
  },
  {
    name: "セット",
    sortOrder: 2,
    items: [
      { name: "サンド+ポテト+ドリンクセット", price: 350, description: "お好みのホットサンドに追加で。単品価格からの割引はレジ表示分を加算" },
    ],
  },
  {
    name: "ドリンク",
    sortOrder: 3,
    items: [
      { name: "ブレンドコーヒー", price: 400 },
      { name: "カフェラテ", price: 450 },
      { name: "アイスティー", price: 400 },
      { name: "オレンジジュース", price: 400 },
      { name: "コーラ", price: 350 },
      { name: "ジンジャーエール", price: 400 },
      { name: "ウーロン茶", price: 350 },
    ],
  },
];
