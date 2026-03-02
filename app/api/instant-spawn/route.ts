// Instant spawn API — uses pre-built configs for <3 second agent creation (no Claude Sonnet call)

import { NextResponse } from "next/server";
import { PREBUILT_CONFIGS, type TemplateId } from "@/lib/agents/prebuilt-configs";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkAgentLimit } from "@/lib/billing/usage";

const VALID_TEMPLATES: TemplateId[] = ["support", "sales", "tutor", "content", "research"];

function generateSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { template, session_id } = body;

    if (!template || !VALID_TEMPLATES.includes(template as TemplateId)) {
      return NextResponse.json(
        { error: "Invalid template. Choose: support, sales, tutor, content, or research." },
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

    // Get the pre-built config (deep clone to avoid mutations)
    const baseConfig = PREBUILT_CONFIGS[template as TemplateId];
    const config = JSON.parse(JSON.stringify(baseConfig));

    // Generate a unique slug
    const suffix = generateSuffix();
    config.slug = `${baseConfig.slug}-${suffix}`;

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
      console.error("[instant-spawn] insert error:", insertError);
      return NextResponse.json(
        { error: `Failed to save agent: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ config, slug: agent.slug });
  } catch (error) {
    console.error("[instant-spawn] error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Instant spawn failed: ${message}` },
      { status: 500 }
    );
  }
}
