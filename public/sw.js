// 注文ステータスの変化を知らせるWeb Push通知だけを扱う、最小限のサービスワーカー。
// キャッシュ・オフライン対応は行わない。

self.addEventListener("push", (event) => {
  let payload = { title: "注文状況が更新されました", body: "" };
  try {
    if (event.data) payload = event.data.json();
  } catch {
    // ペイロードが無い/JSONでない場合はデフォルトの文言のまま通知する
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/favicon.ico",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/order"));
});
