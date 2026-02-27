// Agent runtime — the core executor that powers all spawned agent conversations

import { createAdminClient } from "@/lib/supabase/server";
import { buildSystemPrompt } from "@/lib/agents/system-prompt";
import { getToolDefinitions, executeTool } from "@/lib/agents/tools";
import { retrieveMemories, createMemory, shouldSummarize, summarizeConversation } from "@/lib/agents/memory";
import { parseSelfEval, shouldEscalate, getEscalationModel } from "@/lib/agents/self-eval";
import { calculateCost, MODEL_PRICING } from "@/lib/utils/costs";
import type { Agent, AgentConfig } from "@/lib/types/agent";

const MAX_TOOL_ITERATIONS = 3;
const XAI_API_URL = "https://api.x.ai/v1/chat/completions";

interface RuntimeParams {
  agentSlug: string;
  message: string;
  conversationId?: string;
  userId?: string;
  sessionId?: string;
}

interface XAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: XAIToolCall[];
  tool_call_id?: string;
}

interface XAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface SSEChunkDelta {
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: string;
    function?: { name?: string; arguments?: string };
  }>;
}

interface SSEUsage {
  prompt_tokens: number;
  completion_tokens: number;
}

// ============================================================================
// SSE Stream Parser
// ============================================================================

async function* parseSSEStream(
  response: Response
): AsyncGenerator<{ delta: SSEChunkDelta; usage?: SSEUsage }> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep the last potentially incomplete line in buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data);
          const choice = parsed.choices?.[0];
          if (choice?.delta) {
            yield { delta: choice.delta, usage: parsed.usage };
          }
        } catch {
          // Skip unparseable chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ============================================================================
// xAI API Call
// ============================================================================

async function callXAI(
  model: string,
  messages: XAIMessage[],
  tools: ReturnType<typeof getToolDefinitions>,
  temperature: number
): Promise<Response> {
  const body: Record<string, unknown> = {
    model,
    messages,
    stream: true,
    temperature,
  };

  if (tools.length > 0) {
    body.tools = tools;
  }

  const response = await fetch(XAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`xAI API error ${response.status}: ${errorText}`);
  }

  return response;
}

// ============================================================================
// Main Runtime Generator
// ============================================================================

export async function* agentRuntime(
  params: RuntimeParams
): AsyncGenerator<string, string | undefined> {
  const supabase = createAdminClient();
  const { agentSlug, message, userId, sessionId } = params;
  let { conversationId } = params;

  // 1. Load agent
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("*")
    .eq("slug", agentSlug)
    .single();

  if (agentError || !agent) {
    yield "Agent not found.";
    return conversationId;
  }

  const typedAgent = agent as Agent;
  if (typedAgent.status !== "active" && typedAgent.status !== "temp") {
    yield "This agent is currently unavailable.";
    return conversationId;
  }

  const config = typedAgent.config as AgentConfig;

  // 2. Resolve conversation
  if (!conversationId) {
    // Find existing or create new conversation
    let findQuery = supabase
      .from("conversations")
      .select("id")
      .eq("agent_id", typedAgent.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (userId) {
      findQuery = findQuery.eq("user_id", userId);
    } else if (sessionId) {
      findQuery = findQuery.eq("temp_session_id", sessionId);
    }

    const { data: existing } = await findQuery;

    if (existing && existing.length > 0) {
      conversationId = existing[0].id;
    } else {
      const { data: newConvo, error: convoError } = await supabase
        .from("conversations")
        .insert({
          agent_id: typedAgent.id,
          user_id: userId || null,
          temp_session_id: !userId ? sessionId || null : null,
          title: message.slice(0, 100),
        })
        .select("id")
        .single();

      if (convoError || !newConvo) {
        yield "Failed to create conversation.";
        return conversationId;
      }
      conversationId = newConvo.id;
    }
  }

  // 3. Save user message
  await supabase.from("messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: message,
  });

  // 4. Retrieve memories
  const memories = await retrieveMemories(
    typedAgent.id,
    userId || null,
    message
  );

  // 5. Load conversation history (last 50 messages)
  const { data: historyRows } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(50);

  const history = (historyRows || []) as Array<{
    role: string;
    content: string;
  }>;

  // 6. Build system prompt
  const systemPrompt = buildSystemPrompt(
    config,
    memories.length > 0 ? memories : undefined
  );

  // 7. Build messages array
  const apiMessages: XAIMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  // Add history (skip the last message since it's the one we just inserted)
  for (const msg of history.slice(0, -1)) {
    apiMessages.push({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    });
  }

  // Add current user message
  apiMessages.push({ role: "user", content: message });

  // 8. Get tool definitions
  const tools = getToolDefinitions(config.tools);

  // 9-11. Call xAI API with tool loop
  const model =
    (await getConversationModelOverride(supabase, conversationId!)) ||
    config.model;

  let fullResponse = "";
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let toolsWereCalled = false;

  for (let iteration = 0; iteration <= MAX_TOOL_ITERATIONS; iteration++) {
    const response = await callXAI(model, apiMessages, tools, config.temperature);

    let iterationText = "";
    const toolCalls: XAIToolCall[] = [];
    const toolCallBuffers: Map<
      number,
      { id: string; name: string; args: string }
    > = new Map();

    // Process streaming response
    for await (const { delta, usage } of parseSSEStream(response)) {
      // Text content
      if (delta.content) {
        iterationText += delta.content;
        yield delta.content;
      }

      // Tool calls (streamed incrementally)
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!toolCallBuffers.has(tc.index)) {
            toolCallBuffers.set(tc.index, {
              id: tc.id || "",
              name: tc.function?.name || "",
              args: "",
            });
          }
          const buf = toolCallBuffers.get(tc.index)!;
          if (tc.id) buf.id = tc.id;
          if (tc.function?.name) buf.name = tc.function.name;
          if (tc.function?.arguments) buf.args += tc.function.arguments;
        }
      }

      // Capture usage from final chunk
      if (usage) {
        totalTokensIn += usage.prompt_tokens || 0;
        totalTokensOut += usage.completion_tokens || 0;
      }
    }

    fullResponse += iterationText;

    // Assemble complete tool calls
    for (const [, buf] of toolCallBuffers) {
      if (buf.id && buf.name) {
        toolCalls.push({
          id: buf.id,
          type: "function",
          function: { name: buf.name, arguments: buf.args },
        });
      }
    }

    // If no tool calls, we're done
    if (toolCalls.length === 0) break;

    // Execute tools and continue the loop
    toolsWereCalled = true;

    // Add assistant message with tool_calls
    apiMessages.push({
      role: "assistant",
      content: iterationText || null,
      tool_calls: toolCalls,
    });

    // Execute each tool and add results
    for (const tc of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        args = {};
      }

      const result = await executeTool(tc.function.name, args, {
        agentId: typedAgent.id,
        userId,
        sessionId,
      });

      apiMessages.push({
        role: "tool",
        content: result,
        tool_call_id: tc.id,
      });
    }

    // If max iterations reached, break
    if (iteration === MAX_TOOL_ITERATIONS) break;
  }

  // 12. Self-eval
  const selfEval = parseSelfEval(fullResponse, toolsWereCalled);

  // 13. Save assistant message
  const costModel = model in MODEL_PRICING
    ? (model as keyof typeof MODEL_PRICING)
    : "grok-4-1-fast-reasoning";
  const cost = calculateCost(costModel, totalTokensIn, totalTokensOut);

  await supabase.from("messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: fullResponse,
    model_used: model,
    tokens_in: totalTokensIn,
    tokens_out: totalTokensOut,
    cost,
    confidence_score: selfEval.confidence,
  });

  // 14. Save usage log
  await supabase.from("usage_logs").insert({
    agent_id: typedAgent.id,
    user_id: userId || null,
    conversation_id: conversationId,
    tokens_in: totalTokensIn,
    tokens_out: totalTokensOut,
    cost,
    model,
    escalated: model !== config.model,
  });

  // 15. Check memory trigger
  const messageCount = (history?.length || 0) + 2; // +2 for user + assistant
  if (shouldSummarize(messageCount, config.max_turns_before_compact)) {
    const summary = summarizeConversation(
      history.concat([
        { role: "user", content: message },
        { role: "assistant", content: fullResponse },
      ])
    );
    await createMemory(typedAgent.id, userId || null, summary, "summary");
  }

  // 16. Check escalation
  const { data: recentMessages } = await supabase
    .from("messages")
    .select("confidence_score")
    .eq("conversation_id", conversationId)
    .eq("role", "assistant")
    .not("confidence_score", "is", null)
    .order("created_at", { ascending: false })
    .limit(3);

  if (recentMessages && recentMessages.length >= 3) {
    const recentConfidences = recentMessages.map(
      (m: { confidence_score: number | null }) => m.confidence_score!
    );
    if (shouldEscalate(recentConfidences)) {
      const newModel = getEscalationModel(model);
      if (newModel !== model) {
        await supabase
          .from("conversations")
          .update({ model_override: newModel })
          .eq("id", conversationId);
        console.log(
          `[runtime] escalated model from ${model} to ${newModel} for conversation ${conversationId}`
        );
      }
    }
  }

  return conversationId;
}

// ============================================================================
// Helpers
// ============================================================================

async function getConversationModelOverride(
  supabase: ReturnType<typeof createAdminClient>,
  conversationId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("conversations")
    .select("model_override")
    .eq("id", conversationId)
    .single();

  return data?.model_override || null;
}
