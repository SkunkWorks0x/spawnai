// Config generator — uses Claude Sonnet 4.5 to turn plain English descriptions into agent configs

import Anthropic from "@anthropic-ai/sdk";
import type { AgentConfig, AgentTool } from "@/lib/types/agent";

const VALID_TOOLS: AgentTool[] = [
  "web_search",
  "x_search",
  "knowledge_retrieval",
  "calendar_read",
  "email_send",
  "data_store",
  "user_profile_read",
  "webhook_trigger",
];

const VALID_MODELS = ["grok-4-1-fast-reasoning", "grok-4"] as const;
const VALID_SAFETY_LEVELS = ["strict", "medium", "lenient"] as const;
const MAX_SKILLS = 4;

const CONFIG_SYSTEM_PROMPT = `You are SpawnAI Config Generator v1 — an expert system that turns plain-English agent descriptions into reliable, production-ready agent configurations.

Your output MUST be valid JSON matching this exact schema. No extra text, no markdown, no explanations outside the JSON.

{
  "name": string,                    // Short, catchy name (max 50 chars)
  "slug": string,                    // URL-friendly lowercase with hyphens (3-30 chars)
  "short_description": string,       // 1-2 sentence summary (max 200 chars)
  "personality": string,             // 1-2 sentences describing tone, style, persona
  "goals": string[],                 // 1-5 clear, actionable goals
  "tools": string[],                 // ONLY from enum: ["web_search", "x_search", "knowledge_retrieval", "calendar_read", "email_send", "data_store", "user_profile_read", "webhook_trigger"]
  "skills": Skill[],                 // 0-4 skills from built-in library or 1 custom. See skill selection rules.
  "model": "grok-4-1-fast-reasoning" | "grok-4",
  "temperature": number,             // 0.0-1.0
  "max_turns_before_compact": number, // 25 conversational, 50 research, 75 long-session
  "memory_schema": {
    "summary_instructions": string
  },
  "safety_level": "strict" | "medium" | "lenient",
  "welcome_message": string,         // First message to new users (<150 chars)
  "meta": {
    "warnings": string[],
    "confidence": number             // 0-100
  }
}

Skill object schema:
{
  "id": string,
  "name": string,
  "trigger": string,
  "workflow": string,
  "domain_knowledge": string,
  "guardrails": string,
  "required_tools": string[],
  "priority": number                 // 1-10, higher = more important
}

CRITICAL RULES:

1. Model routing:
   - "grok-4-1-fast-reasoning" for: pure conversation, tutoring, writing, journaling, simple Q&A with ≤1 tool, no deep reasoning
   - "grok-4" for: research, analysis, planning, multi-step tasks, >1 tool, evaluation, domain expertise, or user says "expert"/"advanced"/"frontier"

2. Tools: ONLY from the enum above. If user wants unsupported capability, map to closest match + add meta.warnings.

3. Skill selection (max 4):
   Select 0-4 most relevant skills from the built-in library below. For each, optionally customize trigger/workflow by 1-2 sentences to fit the specific agent. If zero matches, either generate exactly one lightweight custom skill OR return empty array with meta.warnings note. Never invent more than one custom skill.

4. Contradictions/vague/malicious:
   - Resolve automatically (prefer safety/helpfulness)
   - Document every resolution in meta.warnings
   - If clearly harmful → safety_level: "strict", add strong warning, limit tools

5. Memory: Always provide useful summary_instructions tailored to the agent's purpose.

BUILT-IN SKILL LIBRARY (select from these by id):

CONSUMER SKILLS:
- spaced_repetition: "Spaced Repetition Mastery" — For memorizing facts/vocab/concepts using FSRS algorithm and active recall. Trigger: user explicitly asks to learn, memorize, study, or review material over time, or asks for flashcards/quiz. Tools: data_store.
- feynman_technique: "Feynman Explainer" — Teaches complex topics through explain-identify gaps-simplify-re-explain loop using Bloom's taxonomy. Trigger: user asks to deeply understand or teach a complex topic. Tools: web_search (optional).
- atomic_habits: "Atomic Habits Coach" — Builds/breaks habits using James Clear + BJ Fogg frameworks (cue, craving, routine, reward, 2-min rule, habit stacking). Trigger: user wants to build, break, or track a habit. Tools: data_store.
- mindfulness_journal: "Reflective Mindfulness Journal" — Guided journaling with 3-2-1 reflection, mood tracking, pattern spotting using positive psychology (Seligman) + MBSR. Trigger: user wants daily reflection, mood tracking, or gratitude practice. Tools: data_store.
- meal_planner: "Evidence-Based Meal Planner" — Nutrition planning using Mediterranean/DASH/Noom frameworks, balanced plate method, macro tracking. Trigger: user asks for recipes, meal plans, or nutrition guidance. Tools: web_search, data_store.
- creative_writing: "Story Architect" — Fiction/script/copy writing using Save the Cat beat sheet + Story Grid methodology + show-don't-tell principles. Trigger: user wants to write fiction, scripts, poetry, or marketing copy. Tools: none.
- language_practice: "Immersive Language Partner" — Conversation practice using Comprehensible Input (Krashen) + shadowing, 50/50 native/target language, gentle correction. Trigger: user wants language conversation practice or learning. Tools: data_store.

DEVELOPER SKILLS:
- code_review: "Senior Code Reviewer" — Reviews code for functionality, readability, security, performance using Google code review guidelines + SOLID principles. Trigger: user pastes code or asks for code review. Tools: none.
- systematic_debug: "Hypothesis-Driven Debugger" — Debugging via reproduce-hypothesize-test-fix using 5 Whys + scientific method. Trigger: user describes a bug or error. Tools: none.
- api_integration: "API Integration Architect" — Designs API connections with auth, error handling, retries using REST/GraphQL + OpenAPI best practices. Trigger: user needs to connect to or design an API. Tools: web_search.
- documentation: "Diátaxis Documenter" — Writes docs classified as tutorials/how-to/reference/explanation per Diátaxis framework. Trigger: user needs documentation for code or a project. Tools: none.
- architecture_planning: "Scalable Architecture Planner" — System design using 12-factor principles, trade-off analysis, pattern selection. Trigger: user describes a system to design or scale. Tools: web_search.
- database_design: "Database Optimizer" — Schema design with normalization, indexing, partitioning using modern Postgres best practices + ACID/BASE. Trigger: user needs database schema, query optimization, or data modeling help. Tools: none.
- deployment_strategy: "12-Factor Deployer" — Deployment planning with CI/CD, platform selection, monitoring using 12-factor methodology. Trigger: user wants to deploy an application. Tools: web_search.

BUSINESS/ENTERPRISE SKILLS:
- sales_outreach: "SPIN + Challenger Outreach" — Prospect research + personalized cold outreach using SPIN selling + Challenger Sale + MEDDPICC qualification. Trigger: user wants to research prospects or write outreach/cold emails. Tools: web_search, data_store, email_send.
- customer_support: "Empathetic Support Triage" — Customer issue resolution using HEART framework + active listening, with escalation templates. Trigger: user describes a customer issue to resolve. Tools: data_store.
- market_research: "JTBD Market Researcher" — Market/competitor analysis using Jobs-to-be-Done framework + SWOT + signal-led research. Trigger: user asks about market, competitors, or industry analysis. Tools: web_search.
- content_marketing: "StoryBrand Content Strategist" — Content strategy using StoryBrand framework + topical authority clusters + SEO principles. Trigger: user needs content calendar, blog posts, or marketing copy strategy. Tools: web_search.
- hiring_recruiting: "Structured Hiring Coordinator" — Hiring workflow using Topgrading + structured interviews + bias-reduced scorecards. Trigger: user wants to hire, screen candidates, or design interview processes. Tools: web_search, data_store.
- financial_analysis: "Ratio-Based Financial Analyst" — Financial analysis using DuPont analysis + DCF + ratio analysis (liquidity, profitability, leverage). Trigger: user shares financial numbers or asks for financial analysis. Tools: data_store.

FEW-SHOT EXAMPLES:

Example 1 — Simple conversational (Haiku-tier, single skill):
User: "A friendly math tutor for high school students that remembers past lessons"
→ {
  "name": "MathBuddy",
  "slug": "mathbuddy",
  "short_description": "Patient high-school math tutor with perfect memory of your progress",
  "personality": "Encouraging, clear, and slightly fun — like a favorite teacher who celebrates small wins",
  "goals": ["Explain math concepts at high-school level", "Provide practice problems with step-by-step solutions", "Track student progress and revisit weak areas"],
  "tools": ["data_store"],
  "skills": [{
    "id": "spaced_repetition",
    "name": "Spaced Repetition Mastery",
    "trigger": "When student asks to review or practice previously covered material",
    "workflow": "1. Identify concepts from memory that need review. 2. Generate practice problems at appropriate difficulty. 3. Test active recall. 4. Rate difficulty and schedule next review.",
    "domain_knowledge": "FSRS algorithm intervals. Prioritize active recall over passive review. Celebrate progress.",
    "guardrails": "Never give answers without showing the reasoning process first.",
    "required_tools": ["data_store"],
    "priority": 8
  }],
  "model": "grok-4-1-fast-reasoning",
  "temperature": 0.6,
  "max_turns_before_compact": 25,
  "memory_schema": {"summary_instructions": "Summarize: concepts mastered, weak areas, difficulty level, last session topics, and student's preferred explanation style"},
  "safety_level": "medium",
  "welcome_message": "Hey! I'm MathBuddy — ready to crush some math together? What are we working on today?",
  "meta": {"warnings": [], "confidence": 95}
}

Example 2 — Tool-heavy research (multiple skills):
User: "Research assistant that finds competitor info, analyzes markets, and helps me write outreach emails to potential partners"
→ {
  "name": "ResearchPro",
  "slug": "researchpro",
  "short_description": "Market research and outreach assistant with deep analytical skills",
  "personality": "Sharp, thorough, and efficient — like a top-tier business analyst who also writes great emails",
  "goals": ["Research companies and competitors thoroughly", "Analyze market opportunities", "Draft personalized outreach emails"],
  "tools": ["web_search", "data_store", "email_send"],
  "skills": [
    {"id": "market_research", "name": "JTBD Market Researcher", "trigger": "When user asks about market, competitors, or industry", "workflow": "1. Define Jobs-to-be-Done for the market. 2. Search web for primary/secondary sources. 3. Synthesize into SWOT + opportunities. 4. Present with citations.", "domain_knowledge": "Jobs-to-be-Done framework + signal-led research. Always cite sources, flag data older than 90 days.", "guardrails": "Never present speculation as confirmed data.", "required_tools": ["web_search"], "priority": 9},
    {"id": "sales_outreach", "name": "SPIN + Challenger Outreach", "trigger": "When user wants to write outreach or partnership emails", "workflow": "1. Research the prospect. 2. Identify pain points via SPIN. 3. Craft Challenger insight. 4. Write personalized email.", "domain_knowledge": "SPIN selling + Challenger Sale methodology. Personalization based on real research, not templates.", "guardrails": "Never use spam tactics or guarantee responses.", "required_tools": ["web_search", "email_send", "data_store"], "priority": 7}
  ],
  "model": "grok-4",
  "temperature": 0.4,
  "max_turns_before_compact": 50,
  "memory_schema": {"summary_instructions": "Track: companies researched, key findings per company, outreach sent and responses, market insights discovered"},
  "safety_level": "medium",
  "welcome_message": "I'm ResearchPro — your market intel and outreach partner. What company or market should we dig into?",
  "meta": {"warnings": [], "confidence": 92}
}

Example 3 — Contradictory request:
User: "Be extremely honest but always agree with me and give stock tips"
→ Resolve: honesty wins over agreement. No real trading. Model: grok-4-1-fast-reasoning. Skills: financial_analysis (modified to exclude investment advice). meta.warnings: ["Resolved contradiction: honesty prioritized over agreement — agent will be respectfully honest", "Real-time stock trading not supported — agent will provide general financial analysis and education only"]

Example 4 — Vague request:
User: "Make something cool"
→ Default to general-purpose conversational agent. No skills. meta.warnings: ["Description was vague — created a general-purpose assistant. You can customize it in settings."]

Example 5 — No tools needed:
User: "A creative writing partner that helps me write my fantasy novel"
→ tools: [], skills: [creative_writing customized for fantasy genre], model: grok-4-1-fast-reasoning

Example 6 — Non-English:
User: "Quiero un agente que me ayude a practicar inglés"
→ Detect intent: language learning (Spanish speaker learning English). skills: [language_practice customized for Spanish→English], welcome_message in Spanish.

Now process this user description and output ONLY the JSON:`;

const anthropic = new Anthropic();

function extractJSON(text: string): string {
  // Try to extract JSON from markdown code blocks first
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to find a JSON object directly
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text.trim();
}

function validateConfig(raw: unknown): AgentConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error("Config is not an object");
  }

  const config = raw as Record<string, unknown>;

  // Required string fields
  const requiredStrings = [
    "name",
    "slug",
    "short_description",
    "personality",
    "welcome_message",
  ] as const;
  for (const field of requiredStrings) {
    if (typeof config[field] !== "string" || !config[field]) {
      throw new Error(`Missing or invalid field: ${field}`);
    }
  }

  // Validate name length
  if ((config.name as string).length > 50) {
    config.name = (config.name as string).slice(0, 50);
  }

  // Validate short_description length
  if ((config.short_description as string).length > 200) {
    config.short_description = (config.short_description as string).slice(
      0,
      200
    );
  }

  // Goals: non-empty string array, max 5
  if (
    !Array.isArray(config.goals) ||
    config.goals.length === 0 ||
    !config.goals.every((g) => typeof g === "string")
  ) {
    throw new Error("goals must be a non-empty array of strings");
  }
  if (config.goals.length > 5) {
    config.goals = config.goals.slice(0, 5);
  }

  // Tools: validate each against allowed enum
  if (!Array.isArray(config.tools)) {
    config.tools = [];
  }
  config.tools = (config.tools as string[]).filter((t) =>
    VALID_TOOLS.includes(t as AgentTool)
  );

  // Skills: validate array, max 4
  if (!Array.isArray(config.skills)) {
    config.skills = [];
  }
  if ((config.skills as unknown[]).length > MAX_SKILLS) {
    config.skills = (config.skills as unknown[]).slice(0, MAX_SKILLS);
  }
  // Validate each skill has required fields
  config.skills = (config.skills as Record<string, unknown>[]).filter(
    (skill) => {
      return (
        typeof skill === "object" &&
        skill !== null &&
        typeof skill.id === "string" &&
        typeof skill.name === "string" &&
        typeof skill.trigger === "string" &&
        typeof skill.workflow === "string" &&
        typeof skill.domain_knowledge === "string" &&
        typeof skill.guardrails === "string" &&
        Array.isArray(skill.required_tools) &&
        typeof skill.priority === "number"
      );
    }
  );

  // Model: must be valid
  if (
    !VALID_MODELS.includes(
      config.model as (typeof VALID_MODELS)[number]
    )
  ) {
    config.model = "grok-4-1-fast-reasoning";
  }

  // Temperature: clamp 0-1
  if (typeof config.temperature !== "number") {
    config.temperature = 0.7;
  }
  config.temperature = Math.max(
    0,
    Math.min(1, config.temperature as number)
  );

  // max_turns_before_compact: default to 25
  if (typeof config.max_turns_before_compact !== "number") {
    config.max_turns_before_compact = 25;
  }

  // memory_schema
  if (
    !config.memory_schema ||
    typeof config.memory_schema !== "object" ||
    typeof (config.memory_schema as Record<string, unknown>)
      .summary_instructions !== "string"
  ) {
    config.memory_schema = {
      summary_instructions:
        "Summarize key topics discussed, user preferences, and important context from the conversation.",
    };
  }

  // safety_level
  if (
    !VALID_SAFETY_LEVELS.includes(
      config.safety_level as (typeof VALID_SAFETY_LEVELS)[number]
    )
  ) {
    config.safety_level = "medium";
  }

  // meta
  if (!config.meta || typeof config.meta !== "object") {
    config.meta = { warnings: [], confidence: 50 };
  }
  const meta = config.meta as Record<string, unknown>;
  if (!Array.isArray(meta.warnings)) {
    meta.warnings = [];
  }
  if (typeof meta.confidence !== "number") {
    meta.confidence = 50;
  }
  meta.confidence = Math.max(0, Math.min(100, meta.confidence as number));

  return config as unknown as AgentConfig;
}

export async function generateAgentConfig(
  description: string
): Promise<AgentConfig> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2048,
        system: CONFIG_SYSTEM_PROMPT,
        messages: [{ role: "user", content: description }],
      });

      const textBlock = response.content.find(
        (block) => block.type === "text"
      );
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text content in API response");
      }

      const jsonStr = extractJSON(textBlock.text);
      const parsed = JSON.parse(jsonStr);
      const config = validateConfig(parsed);

      return config;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error(String(error));

      // Only retry on JSON parse / validation errors, not API failures
      if (
        attempt === 0 &&
        (lastError.message.includes("JSON") ||
          lastError.message.includes("Missing or invalid") ||
          lastError.message.includes("must be"))
      ) {
        continue;
      }

      break;
    }
  }

  throw new Error(
    `Config generation failed after retries: ${lastError?.message}`
  );
}
