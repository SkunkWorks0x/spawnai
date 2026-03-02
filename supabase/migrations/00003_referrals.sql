-- Add referral tracking columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_source text,
  ADD COLUMN IF NOT EXISTS referral_agent_slug text;

-- Add total_conversations column to agents if it doesn't exist
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS total_conversations integer DEFAULT 0;
