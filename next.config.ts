import type { NextConfig } from "next";

// nonceを使わない静的なCSP。Next.jsが自前で挿入するhydration用の
// インラインscript/styleを許可する必要があるため script-src / style-src に
// 'unsafe-inline' を残しているが、それ以外の主要な攻撃面
// （クリックジャッキング・<base>タグ差し替え・別オリジンへのフォーム送信・
// 危険なプラグイン埋め込み）は塞ぐ。nonceベースの厳格なCSPにするには
// src/proxy.ts 側でリクエストごとのnonce発行が必要になるため、次の改善候補
// として残す。
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // メニュー画像（MenuItem.imageUrl）は外部ホストのURLを直接指定する仕様
  // （README「既知の制約」参照）のため、https 全般を許可する。
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // frame-ancestors 'none' と重複するが、CSP非対応の古いクライアント向けの保険。
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
