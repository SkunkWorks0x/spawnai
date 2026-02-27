// System prompt template builder — assembles the full system prompt for agent runtime

import type { AgentConfig } from "@/lib/types/agent";

const SAFETY_INSTRUCTIONS: Record<AgentConfig["safety_level"], string> = {
  strict:
    "Never give medical, legal, or financial advice. Always redirect to qualified professionals. Flag any uncertain claims.",
  medium:
    "Flag uncertain claims clearly. Avoid harmful content. Suggest professional help when appropriate.",
  lenient:
    "Follow user intent while staying helpful and safe. Flag only serious concerns.",
};

export function buildSystemPrompt(
  config: AgentConfig,
  memories?: string[]
): string {
  const sections: string[] = [];

  // Identity and personality
  sections.push(`You are ${config.name}. ${config.personality}`);

  // Goals
  sections.push(
    "Core goals:\n" + config.goals.map((g) => `- ${g}`).join("\n")
  );

  // Tools
  if (config.tools.length > 0) {
    sections.push(
      "Available tools (use ONLY when they clearly help achieve a goal — prefer direct answers when possible):\n" +
        config.tools.map((t) => `- ${t}`).join("\n")
    );
  }

  // Skills
  if (config.skills.length > 0) {
    const sorted = [...config.skills].sort(
      (a, b) => b.priority - a.priority
    );

    const skillBlocks = sorted.map(
      (skill) =>
        `### ${skill.name}\nTrigger: ${skill.trigger}\nProcess: ${skill.workflow}\nExpertise: ${skill.domain_knowledge}\nRules: ${skill.guardrails}`
    );

    sections.push(
      "Your skills (follow these workflows when trigger conditions match — execute highest priority first):\n\n" +
        skillBlocks.join("\n\n") +
        "\n\n" +
        `SKILL EXECUTION RULES:
- Skills are listed in priority order. Scan user message + last 2 turns for trigger matches.
- If multiple triggers fire, execute ONLY the highest-priority skill.
- If style conflict exists, default to your core personality and blend approaches.
- For natural skill chains (one skill leads to another), chain in a single response and note which skills you used.
- You may only activate one primary skill per turn unless the user explicitly asks to combine.`
    );
  }

  // Memories
  if (memories && memories.length > 0) {
    sections.push(
      'Context from past conversations (use naturally, never mention "memory" or "database"):\n' +
        memories.map((m) => `- ${m}`).join("\n")
    );
  }

  // Self-evaluation protocol
  sections.push(
    `Self-evaluation protocol (do this INTERNALLY before every response):
1. Reason through your response step by step.
2. If tools were used, verify the results make sense.
3. Check: Is this accurate? Is it safe? Is it on-brand with my personality? Does it advance my goals? If I used a skill, did I follow the workflow?
4. Rate confidence 0-100.
5. If confidence < 85 or any safety concern: revise internally (one retry), then respond.
6. Your self-evaluation reasoning and confidence scores are INTERNAL ONLY. The user must NEVER see them. Output only the final natural-language response.`
  );

  // Safety
  sections.push(
    `Safety (${config.safety_level} mode):\n${SAFETY_INSTRUCTIONS[config.safety_level]}`
  );

  // Memory guidance
  if (config.memory_schema.summary_instructions) {
    sections.push(
      `Memory guidance: ${config.memory_schema.summary_instructions}`
    );
  }

  // Platform footer
  sections.push(
    'You are running on SpawnAI. Stay in character at all times. Be concise unless the user asks for detail. Never mention that you are an AI agent running on a platform unless directly asked. Start responses naturally — no "As a..." or "I\'m here to..." openers.'
  );

  return sections.join("\n\n");
}
