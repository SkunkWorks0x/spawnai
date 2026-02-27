// Token cost calculation helpers
// TODO: Define per-model pricing (Grok-4.1-Fast, Grok-4, Claude Sonnet)
// TODO: Calculate cost from token counts
// TODO: Track cumulative session costs

export const MODEL_PRICING = {
  "grok-4-1-fast-reasoning": { input: 0.20, output: 0.50 }, // per million tokens
  "grok-4": { input: 2.00, output: 8.00 },
  "claude-sonnet-4-5-20250929": { input: 3.00, output: 15.00 },
} as const;

export function calculateCost(
  model: keyof typeof MODEL_PRICING,
  tokensIn: number,
  tokensOut: number
): number {
  const pricing = MODEL_PRICING[model];
  return (tokensIn * pricing.input + tokensOut * pricing.output) / 1_000_000;
}
