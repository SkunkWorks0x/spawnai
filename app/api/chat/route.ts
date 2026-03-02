// Streaming chat API route — powers all agent conversations via SSE

import { agentRuntime } from "@/lib/agents/runtime";
import { createClient } from "@/lib/supabase/server";
import { checkUsageLimits, incrementUsage } from "@/lib/billing/usage";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agent_slug, message, conversation_id, session_id } = body;

    if (!agent_slug || typeof agent_slug !== "string") {
      return new Response(
        JSON.stringify({ error: "agent_slug is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user_id from auth (if authenticated)
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id;

    // Check usage limits before processing
    const usage = await checkUsageLimits(userId, session_id);
    if (!usage.allowed) {
      const encoder = new TextEncoder();
      const limitStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error: "limit_reached",
                message: usage.reason,
                currentUsage: usage.currentUsage,
                limit: usage.limit,
                plan: usage.plan,
                upgradeUrl: "/pricing",
              })}\n\n`
            )
          );
          controller.close();
        },
      });
      return new Response(limitStream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const runtime = agentRuntime({
      agentSlug: agent_slug,
      message: message.trim(),
      conversationId: conversation_id,
      userId,
      sessionId: session_id,
    });

    // Create SSE stream
    let resolvedConversationId = conversation_id;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          let result = await runtime.next();
          while (!result.done) {
            const chunk = result.value;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ text: chunk })}\n\n`
              )
            );
            result = await runtime.next();
          }

          // Generator return value is the conversation_id
          if (result.value) {
            resolvedConversationId = result.value;
          }

          // Increment usage after successful response
          await incrementUsage(userId, session_id);

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                conversation_id: resolvedConversationId,
                usage: {
                  currentUsage: usage.currentUsage + 1,
                  limit: usage.limit,
                  plan: usage.plan,
                },
              })}\n\n`
            )
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          console.error("[chat] runtime error:", errorMessage);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: errorMessage })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[chat] request error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
