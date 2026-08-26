import "server-only";
import { auth } from "@/auth";

// クッキーのセッションだけで認可するAPI（＝スタッフAPI全般）は、ログイン済み
// スタッフのブラウザを騙って別サイトから状態変更リクエストを送らせるCSRFの
// 対象になりうる。OriginヘッダーとHostヘッダーを突き合わせ、一致しない
// （＝別オリジンから送られた）リクエストは弾く。Originを送らないクライアント
// も一部存在するため、Origin自体が無い場合は誤検知を避けて許可する。
function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// Proxy（src/proxy.ts）は /staff の画面遷移をガードするが、Next.js公式ドキュ
// メントも警告する通り、ルーティング上の抜け漏れに備えて各APIルート側でも
// 個別に認証を確認する（多層防御）。
//
// requestを渡した呼び出し（状態を変更するPOST/PATCH/DELETE）では、上記の
// Origin検証も合わせて行う。GET専用の呼び出しは引数を省略してよい
// （読み取り専用でCSRFの対象にならないため）。
export async function requireStaffSession(request?: Request) {
  if (request && !isSameOriginRequest(request)) return null;
  const session = await auth();
  if (!session?.user) return null;
  return session;
}
