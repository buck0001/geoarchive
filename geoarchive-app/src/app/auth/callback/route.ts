import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeReturnTo } from "@/lib/safe-return-to";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = request.nextUrl.searchParams.get("next");
  const next = safeReturnTo(nextPath);

  if (code) {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.redirect(new URL("/login?message=Supabase%20is%20not%20configured", request.url));
    }
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(new URL("/login?message=Email%20confirmation%20failed", request.url));
}
