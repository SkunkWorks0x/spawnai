// Config generation API route — generates config via Claude Sonnet, saves agent to DB server-side

import { NextResponse } from "next/server";
import { generateAgentConfig } from "@/lib/agents/config-generator";
import { generateSlug } from "@/lib/utils/slug";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkAgentLimit } from "@/lib/billing/usage";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { description, session_id } = body;

    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { error: "description is required and must be a string" },
        { status: 400 }
      );
    }

    const trimmed = description.trim();

    if (trimmed.length === 0) {
      return NextResponse.json(
        { error: "description cannot be empty" },
        { status: 400 }
      );
    }

    if (trimmed.length > 2000) {
      return NextResponse.json(
        { error: "description must be under 2000 characters" },
        { status: 400 }
      );
    }

    // Check if user is authenticated
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Check agent creation limit
    const agentLimit = await checkAgentLimit(user?.id, session_id);
    if (!agentLimit.allowed) {
      return NextResponse.json(
        {
          error: `You've reached your free plan limit of ${agentLimit.limit} agents. Upgrade to Pro for up to 25 agents.`,
          limitReached: true,
          currentCount: agentLimit.currentCount,
          limit: agentLimit.limit,
        },
        { status: 403 }
      );
    }

    // Generate config via Claude Sonnet
    const config = await generateAgentConfig(trimmed);
    config.slug = generateSlug(config.name);

    // Insert agent using admin client (bypasses RLS)
    const admin = createAdminClient();
    const { data: agent, error: insertError } = await admin
      .from("agents")
      .insert({
        owner_id: user?.id || null,
        slug: config.slug,
        config,
        status: user ? "active" : "temp",
        public: true,
        temp_session_id: user ? null : session_id || null,
      })
      .select("slug")
      .single();

    if (insertError) {
      console.error("Agent insert error:", insertError);
      return NextResponse.json(
        { error: `Failed to save agent: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ config, slug: agent.slug });
  } catch (error) {
    console.error("Config generation error:", error);

    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Config generation failed: ${message}` },
      { status: 500 }
    );
  }
}
