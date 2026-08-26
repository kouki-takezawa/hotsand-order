import { Suspense } from "react";
import { getSettings } from "@/lib/data";
import { LoginForm } from "@/components/staff/LoginForm";

export const dynamic = "force-dynamic";

export default async function StaffLoginPage() {
  const settings = await getSettings();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6">
      <div className="text-center">
        <p className="text-sm font-medium text-muted">{settings.restaurantName}</p>
        <h1 className="mt-1 text-xl font-bold text-foreground">スタッフログイン</h1>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
