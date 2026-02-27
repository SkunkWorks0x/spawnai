// Test script for config generation
// Run with: npx tsx scripts/test-config-gen.ts

import "dotenv/config";
import { generateAgentConfig } from "../lib/agents/config-generator";
import { buildSystemPrompt } from "../lib/agents/system-prompt";
import type { AgentConfig, AgentSkill } from "../lib/types/agent";

const VALID_TOOLS = [
  "web_search",
  "x_search",
  "knowledge_retrieval",
  "calendar_read",
  "email_send",
  "data_store",
  "user_profile_read",
  "webhook_trigger",
];

const VALID_MODELS = ["grok-4-1-fast-reasoning", "grok-4"];
const VALID_SAFETY_LEVELS = ["strict", "medium", "lenient"];

function validateOutput(config: AgentConfig): string[] {
  const errors: string[] = [];

  // Required string fields
  if (!config.name || typeof config.name !== "string")
    errors.push("missing name");
  if (!config.slug || typeof config.slug !== "string")
    errors.push("missing slug");
  if (!config.short_description || typeof config.short_description !== "string")
    errors.push("missing short_description");
  if (!config.personality || typeof config.personality !== "string")
    errors.push("missing personality");
  if (!config.welcome_message || typeof config.welcome_message !== "string")
    errors.push("missing welcome_message");

  // Goals
  if (!Array.isArray(config.goals) || config.goals.length === 0)
    errors.push("goals must be a non-empty array");
  if (config.goals.length > 5) errors.push("goals exceeds max of 5");

  // Tools
  if (!Array.isArray(config.tools)) errors.push("tools must be an array");
  for (const tool of config.tools) {
    if (!VALID_TOOLS.includes(tool))
      errors.push(`invalid tool: ${tool}`);
  }

  // Skills
  if (!Array.isArray(config.skills)) errors.push("skills must be an array");
  if (config.skills.length > 4) errors.push("skills exceeds max of 4");
  for (const skill of config.skills) {
    const requiredFields: (keyof AgentSkill)[] = [
      "id",
      "name",
      "trigger",
      "workflow",
      "domain_knowledge",
      "guardrails",
      "required_tools",
      "priority",
    ];
    for (const field of requiredFields) {
      if (skill[field] === undefined || skill[field] === null) {
        errors.push(`skill "${skill.id || "unknown"}" missing field: ${field}`);
      }
    }
  }

  // Model
  if (!VALID_MODELS.includes(config.model))
    errors.push(`invalid model: ${config.model}`);

  // Temperature
  if (
    typeof config.temperature !== "number" ||
    config.temperature < 0 ||
    config.temperature > 1
  )
    errors.push(`invalid temperature: ${config.temperature}`);

  // max_turns_before_compact
  if (typeof config.max_turns_before_compact !== "number")
    errors.push("missing max_turns_before_compact");

  // memory_schema
  if (
    !config.memory_schema ||
    typeof config.memory_schema.summary_instructions !== "string"
  )
    errors.push("missing memory_schema.summary_instructions");

  // safety_level
  if (!VALID_SAFETY_LEVELS.includes(config.safety_level))
    errors.push(`invalid safety_level: ${config.safety_level}`);

  // meta
  if (!config.meta) errors.push("missing meta");
  if (!Array.isArray(config.meta?.warnings))
    errors.push("meta.warnings must be an array");
  if (typeof config.meta?.confidence !== "number")
    errors.push("meta.confidence must be a number");

  return errors;
}

async function main() {
  console.log("=== SpawnAI Config Generator Test ===\n");

  const description =
    "A friendly math tutor that remembers my progress";

  console.log(`Input: "${description}"\n`);
  console.log("Generating config...\n");

  try {
    const config = await generateAgentConfig(description);

    console.log("--- Generated Config ---");
    console.log(JSON.stringify(config, null, 2));

    console.log("\n--- Validation ---");
    const errors = validateOutput(config);
    if (errors.length === 0) {
      console.log("PASS: All fields valid");
    } else {
      console.log("FAIL: Validation errors:");
      errors.forEach((e) => console.log(`  - ${e}`));
    }

    console.log("\n--- Config Summary ---");
    console.log(`Name: ${config.name}`);
    console.log(`Model: ${config.model}`);
    console.log(`Tools: [${config.tools.join(", ")}]`);
    console.log(`Skills: [${config.skills.map((s) => s.id).join(", ")}]`);
    console.log(`Safety: ${config.safety_level}`);
    console.log(`Temperature: ${config.temperature}`);
    console.log(`Confidence: ${config.meta.confidence}`);
    if (config.meta.warnings.length > 0) {
      console.log(`Warnings: ${config.meta.warnings.join("; ")}`);
    }

    // Test system prompt builder
    console.log("\n--- System Prompt Preview (first 500 chars) ---");
    const systemPrompt = buildSystemPrompt(config, [
      "User struggles with quadratic equations",
      "Prefers visual explanations",
    ]);
    console.log(systemPrompt.slice(0, 500) + "...\n");
    console.log(`Full system prompt length: ${systemPrompt.length} chars`);
  } catch (error) {
    console.error("FAIL: Generation error:", error);
    process.exit(1);
  }
}

main();
