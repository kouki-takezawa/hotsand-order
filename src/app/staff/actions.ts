"use server";

import { signOut } from "@/auth";

export async function staffSignOut() {
  await signOut({ redirectTo: "/staff/login" });
}
