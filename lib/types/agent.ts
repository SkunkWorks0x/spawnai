// TypeScript types for SpawnAI — matches database schema and agent config JSON structure

// ============================================================================
// Agent Config (stored as JSONB in agents.config)
// ============================================================================

export type AgentTool =
  | "web_search"
  | "x_search"
  | "knowledge_retrieval"
  | "calendar_read"
  | "email_send"
  | "data_store"
  | "user_profile_read"
  | "webhook_trigger";

export interface AgentSkill {
  id: string;
  name: string;
  trigger: string;
  workflow: string;
  domain_knowledge: string;
  guardrails: string;
  required_tools: string[];
  priority: number;
}

export interface AgentConfig {
  name: string;
  slug: string;
  short_description: string;
  personality: string;
  goals: string[];
  tools: AgentTool[];
  skills: AgentSkill[];
  model: "grok-4-1-fast-reasoning" | "grok-4";
  temperature: number;
  max_turns_before_compact: number;
  memory_schema: {
    summary_instructions: string;
  };
  safety_level: "strict" | "medium" | "lenient";
  welcome_message: string;
  meta: {
    warnings: string[];
    confidence: number;
  };
}

// ============================================================================
// Database Row Types
// ============================================================================

export type AgentStatus = "active" | "paused" | "suspended" | "temp";

export interface Agent {
  id: string;
  owner_id: string | null;
  slug: string;
  config: AgentConfig;
  status: AgentStatus;
  public: boolean;
  temp_session_id: string | null;
  total_conversations: number;
  total_messages: number;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  agent_id: string;
  user_id: string | null;
  temp_session_id: string | null;
  title: string | null;
  model_override: string | null;
  created_at: string;
  updated_at: string;
}

export type MessageRole = "user" | "assistant" | "system";

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  model_used: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cost: number | null;
  confidence_score: number | null;
  created_at: string;
}

export type MemoryType = "episodic" | "semantic" | "summary";

export interface Memory {
  id: string;
  agent_id: string;
  user_id: string | null;
  content: string;
  memory_type: MemoryType;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface UsageLog {
  id: string;
  agent_id: string;
  user_id: string | null;
  conversation_id: string | null;
  tokens_in: number;
  tokens_out: number;
  cost: number;
  model: string;
  escalated: boolean;
  created_at: string;
}

// ============================================================================
// Materialized View Types
// ============================================================================

export interface AgentStats {
  agent_id: string;
  total_conversations: number;
  total_messages: number;
  avg_confidence: number;
  total_cost: number;
  escalation_count: number;
  last_active: string | null;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface GenerateConfigRequest {
  description: string;
  temp_session_id?: string;
}

export interface GenerateConfigResponse {
  slug: string;
  agent_id: string;
  config: AgentConfig;
}

export interface ChatRequest {
  agent_id: string;
  conversation_id?: string;
  message: string;
  temp_session_id?: string;
}

export interface RetrievedMemory {
  id: string;
  content: string;
  metadata: Record<string, unknown> | null;
  similarity: number;
}
