// Next.js middleware — auth session refresh + temp_session_id cookie management

import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Refresh Supabase auth session
  const response = await updateSession(request);

  // Ensure temp_session_id cookie exists for anonymous users
  if (!request.cookies.get("temp_session_id")) {
    const tempId = crypto.randomUUID();
    response.cookies.set("temp_session_id", tempId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 48, // 48 hours
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
