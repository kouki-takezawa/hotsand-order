import { redirect } from "next/navigation";

export default function SettingsIndexPage() {
  redirect("/staff/settings/general");
}
