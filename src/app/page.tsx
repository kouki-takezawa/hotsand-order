import { redirect } from "next/navigation";

// 客はQRコードから直接 /order または /order/[卓番号] にアクセスするため、
// ルートURLは店舗スタッフのログイン画面にする。
export default function HomePage() {
  redirect("/staff/login");
}
