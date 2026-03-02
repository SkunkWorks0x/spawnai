// Next.js middleware — auth session refresh + temp_session_id cookie + referral tracking

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

  // Capture referral params into cookies (ref=embed|agent|share, agent=slug)
  const ref = request.nextUrl.searchParams.get("ref");
  const agent = request.nextUrl.searchParams.get("agent");

  if (ref && !request.cookies.get("spawnai_ref")) {
    response.cookies.set("spawnai_ref", ref, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });
  }

  if (agent && !request.cookies.get("spawnai_ref_agent")) {
    response.cookies.set("spawnai_ref_agent", agent, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
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
