import { NextResponse } from "next/server";
import { getMenu } from "@/lib/data";

export async function GET() {
  const categories = await getMenu();
  return NextResponse.json({ categories });
}
