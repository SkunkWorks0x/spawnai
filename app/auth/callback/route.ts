// Auth callback — handles OAuth/magic link redirects from Supabase Auth

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check for temp_session_id cookie
      const cookieStore = await cookies();
      const tempSessionId = cookieStore.get("temp_session_id")?.value;

      if (tempSessionId) {
        // Get the newly authenticated user
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          // Claim temp data using admin client (bypasses RLS)
          const admin = createAdminClient();
          const { error: claimError } = await admin.rpc("claim_temp_data", {
            p_temp_session_id: tempSessionId,
            p_user_id: user.id,
          });

          if (claimError) {
            console.error("[auth] claim_temp_data error:", claimError.message);
          }

          // Check if a claimed agent exists — redirect to it
          const { data: claimedAgent } = await admin
            .from("agents")
            .select("slug")
            .eq("owner_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(1);

          // Delete the temp cookie
          cookieStore.delete("temp_session_id");

          if (claimedAgent && claimedAgent.length > 0) {
            return NextResponse.redirect(
              `${origin}/a/${claimedAgent[0].slug}`
            );
          }
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth error — redirect to home
  return NextResponse.redirect(`${origin}/?error=auth`);
}
