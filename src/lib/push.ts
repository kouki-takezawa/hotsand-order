import "server-only";
import webpush from "web-push";

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT ?? "mailto:notifications@example.com";

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// VAPIDキーが未設定の環境（ローカルで.env.localを用意していない等）でも
// 通知機能以外が壊れないよう、キー未設定時は静かに何もしない。
// endpointが失効している（410/404）場合は expired: true を返し、
// 呼び出し元でDB上の購読情報を消せるようにする。
export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: { title: string; body: string }
): Promise<{ expired: boolean }> {
  if (!publicKey || !privateKey) return { expired: false };
  try {
    await webpush.sendNotification(subscription as webpush.PushSubscription, JSON.stringify(payload));
    return { expired: false };
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) return { expired: true };
    console.error("Failed to send push notification", error);
    return { expired: false };
  }
}
