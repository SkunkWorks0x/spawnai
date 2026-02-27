// Memory retrieval and storage helpers — pgvector-backed long-term memory

import { createAdminClient } from "@/lib/supabase/server";
import type { MemoryType } from "@/lib/types/agent";

export async function retrieveMemories(
  agentId: string,
  userId: string | null,
  query: string,
  limit: number = 5
): Promise<string[]> {
  const supabase = createAdminClient();

  // v1: text search fallback (no embeddings yet)
  const keywords = query
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5);

  if (keywords.length === 0) return [];

  // Build ilike patterns for each keyword
  const pattern = `%${keywords.join("%")}%`;

  let dbQuery = supabase
    .from("memories")
    .select("content")
    .eq("agent_id", agentId)
    .ilike("content", pattern)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (userId) {
    dbQuery = dbQuery.or(`user_id.eq.${userId},user_id.is.null`);
  }

  const { data, error } = await dbQuery;

  if (error) {
    console.error("[memory] retrieval error:", error.message);
    return [];
  }

  return (data || []).map((m: { content: string }) => m.content);
}

export async function createMemory(
  agentId: string,
  userId: string | null,
  content: string,
  type: MemoryType
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("memories").insert({
    agent_id: agentId,
    user_id: userId,
    content,
    memory_type: type,
    embedding: null,
  });

  if (error) {
    console.error("[memory] creation error:", error.message);
  }
}

export function shouldSummarize(
  messageCount: number,
  maxTurns: number
): boolean {
  return messageCount >= maxTurns;
}

export function summarizeConversation(
  messages: Array<{ role: string; content: string }>
): string {
  // v1: simple extraction — not an LLM call
  const topics = new Set<string>();
  const decisions: string[] = [];
  const facts: string[] = [];

  for (const msg of messages) {
    if (msg.role === "system") continue;

    const content = msg.content;

    // Extract key phrases — look for declarative statements
    if (msg.role === "user") {
      // User questions/requests become topics
      const firstSentence = content.split(/[.!?]/)[0]?.trim();
      if (firstSentence && firstSentence.length > 10) {
        topics.add(firstSentence.slice(0, 100));
      }
    }

    if (msg.role === "assistant") {
      // Look for decisions/conclusions
      const lines = content.split("\n").filter((l) => l.trim().length > 0);
      for (const line of lines.slice(0, 3)) {
        if (
          line.includes("should") ||
          line.includes("recommend") ||
          line.includes("decided") ||
          line.includes("conclusion")
        ) {
          decisions.push(line.trim().slice(0, 150));
        }
      }

      // First substantive line as a fact
      const firstLine = lines[0]?.trim();
      if (firstLine && firstLine.length > 20 && facts.length < 5) {
        facts.push(firstLine.slice(0, 150));
      }
    }
  }

  const parts: string[] = [];
  if (topics.size > 0) {
    parts.push(
      "Topics discussed: " + [...topics].slice(0, 5).join("; ")
    );
  }
  if (decisions.length > 0) {
    parts.push(
      "Key decisions: " + decisions.slice(0, 3).join("; ")
    );
  }
  if (facts.length > 0) {
    parts.push(
      "Key points: " + facts.slice(0, 3).join("; ")
    );
  }

  return parts.join("\n") || "General conversation with no specific conclusions.";
}
