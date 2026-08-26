import type { NextAuthConfig } from "next-auth";

// Proxy（旧middleware）からも読み込める軽量な設定。Prismaやbcryptに依存する
// 実際の認証処理（Credentials provider）はsrc/auth.ts側に置く。
export default {
  pages: {
    signIn: "/staff/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = nextUrl.pathname === "/staff/login";

      if (isLoginPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/staff/orders", nextUrl));
        }
        return true;
      }

      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
