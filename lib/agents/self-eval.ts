// Self-evaluation parsing and escalation logic

const HEDGING_PATTERNS = [
  /i'?m not sure/i,
  /i think maybe/i,
  /i don'?t have enough information/i,
  /i'?m uncertain/i,
  /i can'?t be sure/i,
  /i don'?t really know/i,
  /this might not be accurate/i,
  /take this with a grain of salt/i,
];

export function parseSelfEval(
  response: string,
  toolsWereCalled: boolean = false
): { content: string; confidence: number; needsRetry: boolean } {
  let confidence = 85;

  // Check for hedging language
  const hasHedging = HEDGING_PATTERNS.some((p) => p.test(response));
  if (hasHedging) {
    confidence -= 15;
  }

  // Check for very short responses
  if (response.length < 50) {
    confidence -= 10;
  }

  // Check for generic tool results
  if (toolsWereCalled && /coming soon|not available|no data found/i.test(response)) {
    confidence -= 10;
  }

  confidence = Math.max(0, Math.min(100, confidence));

  return {
    content: response,
    confidence,
    needsRetry: confidence < 50,
  };
}

export function shouldEscalate(conversationConfidences: number[]): boolean {
  if (conversationConfidences.length < 3) return false;
  const last3 = conversationConfidences.slice(-3);
  return last3.every((c) => c < 70);
}

export function getEscalationModel(currentModel: string): string {
  if (currentModel === "grok-4-1-fast-reasoning") return "grok-4";
  return "grok-4"; // already at max
}
