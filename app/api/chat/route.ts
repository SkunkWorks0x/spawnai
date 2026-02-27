// Streaming chat API route — powers all agent conversations via SSE

import { agentRuntime } from "@/lib/agents/runtime";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agent_slug, message, conversation_id, session_id } = body;

    if (!agent_slug || typeof agent_slug !== "string") {
      return new Response(
        JSON.stringify({ error: "agent_slug is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "message is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get user_id from auth (if authenticated)
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id;

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

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                conversation_id: resolvedConversationId,
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
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[chat] request error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
