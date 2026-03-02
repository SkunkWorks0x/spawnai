-- Add tracking columns to agents (some may already exist from prior migrations)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS total_conversations int NOT NULL DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS total_messages int NOT NULL DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS first_message_at timestamptz;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_message_at timestamptz;

-- Function to increment agent stats after each user message
CREATE OR REPLACE FUNCTION increment_agent_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.role = 'user' THEN
    UPDATE agents SET
      total_messages = total_messages + 1,
      last_message_at = now(),
      first_message_at = COALESCE(first_message_at, now())
    WHERE id = (SELECT agent_id FROM conversations WHERE id = NEW.conversation_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on message insert (drop if exists to avoid duplicates)
DROP TRIGGER IF EXISTS trg_increment_agent_stats ON messages;
CREATE TRIGGER trg_increment_agent_stats
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION increment_agent_stats();

-- Function to increment conversation count when new conversation is created
CREATE OR REPLACE FUNCTION increment_conversation_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE agents SET total_conversations = total_conversations + 1
  WHERE id = NEW.agent_id;
  RETURN NEW;
END;
$$;

-- Trigger on conversation insert
DROP TRIGGER IF EXISTS trg_increment_conversations ON conversations;
CREATE TRIGGER trg_increment_conversations
  AFTER INSERT ON conversations
  FOR EACH ROW EXECUTE FUNCTION increment_conversation_count();
