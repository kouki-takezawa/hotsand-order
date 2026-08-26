// 現在提供中のメニュー内容。prisma/seed.ts（初回デプロイ時の初期データ投入）と
// prisma/reset-menu.ts（既存メニューをこの内容に一括更新するスクリプト）の両方から
// 参照する、唯一の正（single source of truth）。メニュー内容を変更するときはここを
// 直接編集するのではなく、通常は設定＞メニュー画面から行う。ここを直接編集するのは
// 「紙メニューが刷新された」など、初期データ・一括更新の基準そのものを変えたいとき。

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
    name: "定番ホットサンド",
    sortOrder: 0,
    items: [
      { name: "ハム&チーズ", price: 550 },
      { name: "ツナマヨ&コーン", price: 600 },
      { name: "たまごサンド", price: 550 },
      { name: "ベーコンエッグ", price: 650, isRecommended: true },
      { name: "ミックスチーズ", price: 600, description: "3種のチーズをたっぷりと" },
      { name: "ポテトベーコン", price: 650 },
    ],
  },
  {
    name: "こだわりホットサンド",
    sortOrder: 1,
    items: [
      { name: "照り焼きチキン", price: 750, isRecommended: true },
      { name: "アボカドシュリンプ", price: 800, isRecommended: true },
      { name: "ローストビーフ", price: 900 },
      { name: "ナポリタン", price: 700, description: "喫茶店風の粉チーズがけ" },
      { name: "明太マヨポテト", price: 700 },
      { name: "カレーチーズ", price: 750 },
    ],
  },
  {
    name: "スイーツホットサンド",
    sortOrder: 2,
    items: [
      { name: "チョコバナナ", price: 600 },
      { name: "シナモンアップル", price: 650 },
      { name: "ベリークリームチーズ", price: 700, isRecommended: true },
    ],
  },
  {
    name: "サイド",
    sortOrder: 3,
    items: [
      { name: "フライドポテト", price: 400 },
      { name: "コールスロー", price: 350 },
      { name: "スープ（本日のスープ）", price: 400 },
      { name: "グリーンサラダ", price: 400 },
    ],
  },
  {
    name: "セット",
    sortOrder: 4,
    items: [
      { name: "サンド+ポテト+ドリンクセット", price: 350, description: "お好みのホットサンドに追加で。単品価格からの割引はレジ表示分を加算" },
    ],
  },
  {
    name: "ドリンク",
    sortOrder: 5,
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
