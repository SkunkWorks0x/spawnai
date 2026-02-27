// Tool definitions and execution handlers for agent runtime

import { createAdminClient } from "@/lib/supabase/server";

interface ToolContext {
  agentId: string;
  userId?: string;
  sessionId?: string;
}

interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// ============================================================================
// Tool Definitions (OpenAI-compatible function calling format)
// ============================================================================

const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  web_search: {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for current information. Use for factual queries, recent events, or when you need up-to-date data.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query",
          },
        },
        required: ["query"],
      },
    },
  },
  x_search: {
    type: "function",
    function: {
      name: "x_search",
      description:
        "Search X/Twitter for recent posts, opinions, and trending discussions on a topic.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query for X/Twitter",
          },
        },
        required: ["query"],
      },
    },
  },
  knowledge_retrieval: {
    type: "function",
    function: {
      name: "knowledge_retrieval",
      description:
        "Search your long-term memory for relevant information from past conversations with this user.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "What to search for in memory",
          },
        },
        required: ["query"],
      },
    },
  },
  data_store: {
    type: "function",
    function: {
      name: "data_store",
      description:
        "Store, retrieve, or list persistent data. Use for saving user preferences, tracking progress, or any data that should persist across conversations.",
      parameters: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: ["save", "get", "list"],
            description: "The operation to perform",
          },
          key: {
            type: "string",
            description: "The key for save/get operations",
          },
          value: {
            type: "string",
            description: "The value to save (for save operation)",
          },
        },
        required: ["operation"],
      },
    },
  },
  email_send: {
    type: "function",
    function: {
      name: "email_send",
      description: "Draft and send an email on behalf of the user.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email address" },
          subject: { type: "string", description: "Email subject line" },
          body: { type: "string", description: "Email body content" },
        },
        required: ["to", "subject", "body"],
      },
    },
  },
  calendar_read: {
    type: "function",
    function: {
      name: "calendar_read",
      description: "Read upcoming calendar events and availability.",
      parameters: {
        type: "object",
        properties: {
          date_range: {
            type: "string",
            description: "The date range to check (e.g. 'today', 'this week')",
          },
        },
        required: ["date_range"],
      },
    },
  },
  user_profile_read: {
    type: "function",
    function: {
      name: "user_profile_read",
      description:
        "Read what you know about this user from past interactions — their preferences, background, and conversation history.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  webhook_trigger: {
    type: "function",
    function: {
      name: "webhook_trigger",
      description: "Trigger an external webhook with custom data.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The webhook URL" },
          payload: {
            type: "string",
            description: "JSON payload to send",
          },
        },
        required: ["url", "payload"],
      },
    },
  },
};

export function getToolDefinitions(enabledTools: string[]): ToolDefinition[] {
  return enabledTools
    .filter((t) => t in TOOL_DEFINITIONS)
    .map((t) => TOOL_DEFINITIONS[t]);
}

// ============================================================================
// Tool Executors
// ============================================================================

async function withTimeout<T>(
  fn: () => Promise<T>,
  ms: number = 5000
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const result = await fn();
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

async function executeWebSearch(args: { query: string }): Promise<string> {
  // v1 stub — swap in a real search provider later
  return `Search functionality coming soon - I'll answer from my knowledge instead. Query was: "${args.query}"`;
}

async function executeXSearch(args: { query: string }): Promise<string> {
  // v1 stub
  return `X/Twitter search coming soon - I'll answer from my knowledge instead. Query was: "${args.query}"`;
}

async function executeKnowledgeRetrieval(
  args: { query: string },
  context: ToolContext
): Promise<string> {
  const supabase = createAdminClient();

  // v1: text search fallback (no embeddings yet)
  const keywords = args.query
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5);

  if (keywords.length === 0) {
    return "No relevant memories found.";
  }

  const pattern = `%${keywords.join("%")}%`;
  let query = supabase
    .from("memories")
    .select("content")
    .eq("agent_id", context.agentId)
    .ilike("content", pattern)
    .limit(5);

  if (context.userId) {
    query = query.or(`user_id.eq.${context.userId},user_id.is.null`);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    return "No relevant memories found.";
  }

  return data.map((m: { content: string }) => m.content).join("\n---\n");
}

async function executeDataStore(
  args: { operation: string; key?: string; value?: string },
  context: ToolContext
): Promise<string> {
  const supabase = createAdminClient();

  if (args.operation === "save") {
    if (!args.key || !args.value) return "Error: save requires key and value.";

    const { error } = await supabase.from("memories").insert({
      agent_id: context.agentId,
      user_id: context.userId || null,
      content: `[data:${args.key}] ${args.value}`,
      memory_type: "semantic",
      metadata: { key: args.key, value: args.value, type: "data_store" },
    });

    if (error) return `Error saving data: ${error.message}`;
    return `Saved "${args.key}" successfully.`;
  }

  if (args.operation === "get") {
    if (!args.key) return "Error: get requires a key.";

    let query = supabase
      .from("memories")
      .select("metadata")
      .eq("agent_id", context.agentId)
      .eq("memory_type", "semantic")
      .contains("metadata", { key: args.key, type: "data_store" })
      .order("created_at", { ascending: false })
      .limit(1);

    if (context.userId) {
      query = query.eq("user_id", context.userId);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      return `No data found for key "${args.key}".`;
    }

    const meta = data[0].metadata as Record<string, unknown>;
    return String(meta?.value ?? "null");
  }

  if (args.operation === "list") {
    let query = supabase
      .from("memories")
      .select("metadata")
      .eq("agent_id", context.agentId)
      .eq("memory_type", "semantic")
      .contains("metadata", { type: "data_store" })
      .order("created_at", { ascending: false })
      .limit(20);

    if (context.userId) {
      query = query.eq("user_id", context.userId);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      return "No stored data found.";
    }

    return data
      .map((d: { metadata: Record<string, unknown> }) => {
        const meta = d.metadata;
        return `${meta?.key}: ${meta?.value}`;
      })
      .join("\n");
  }

  return `Unknown operation: ${args.operation}`;
}

async function executeEmailSend(
  args: { to: string; subject: string; body: string },
  context: ToolContext
): Promise<string> {
  // v1 stub — log draft to data_store
  const supabase = createAdminClient();
  await supabase.from("memories").insert({
    agent_id: context.agentId,
    user_id: context.userId || null,
    content: `[email_draft] To: ${args.to} | Subject: ${args.subject}`,
    memory_type: "semantic",
    metadata: {
      type: "email_draft",
      to: args.to,
      subject: args.subject,
      body: args.body,
    },
  });

  return `Email drafted: "${args.subject}". Email sending will be available soon. Here's what I would send:\n\nTo: ${args.to}\nSubject: ${args.subject}\n\n${args.body}`;
}

async function executeCalendarRead(): Promise<string> {
  return "Calendar integration coming soon. I can help you plan and organize — just tell me your schedule.";
}

async function executeUserProfileRead(
  context: ToolContext
): Promise<string> {
  const supabase = createAdminClient();

  let query = supabase
    .from("memories")
    .select("content")
    .eq("agent_id", context.agentId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (context.userId) {
    query = query.eq("user_id", context.userId);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    return "No profile information available yet. This is a new conversation.";
  }

  return (
    "What I know about this user:\n" +
    data.map((m: { content: string }) => `- ${m.content}`).join("\n")
  );
}

async function executeWebhookTrigger(): Promise<string> {
  return "Webhook integrations coming soon.";
}

// ============================================================================
// Main Executor
// ============================================================================

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolContext
): Promise<string> {
  console.log(`[tool:${toolName}] executing with args:`, args);

  try {
    const result = await withTimeout(async () => {
      switch (toolName) {
        case "web_search":
          return executeWebSearch(args as { query: string });
        case "x_search":
          return executeXSearch(args as { query: string });
        case "knowledge_retrieval":
          return executeKnowledgeRetrieval(
            args as { query: string },
            context
          );
        case "data_store":
          return executeDataStore(
            args as { operation: string; key?: string; value?: string },
            context
          );
        case "email_send":
          return executeEmailSend(
            args as { to: string; subject: string; body: string },
            context
          );
        case "calendar_read":
          return executeCalendarRead();
        case "user_profile_read":
          return executeUserProfileRead(context);
        case "webhook_trigger":
          return executeWebhookTrigger();
        default:
          return `Unknown tool: ${toolName}`;
      }
    });

    console.log(`[tool:${toolName}] completed`);
    return result;
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Tool execution timed out after 5 seconds."
        : `Tool error: ${error instanceof Error ? error.message : "unknown"}`;
    console.error(`[tool:${toolName}] error:`, message);
    return message;
  }
}
