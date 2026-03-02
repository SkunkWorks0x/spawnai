import { createAdminClient } from "@/lib/supabase/server";
import { getPlan } from "@/lib/stripe/config";

interface UsageCheckResult {
  allowed: boolean;
  reason?: string;
  currentUsage: number;
  limit: number;
  plan: string;
}

interface AgentLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
}

export async function checkUsageLimits(
  userId: string | undefined,
  sessionId: string | undefined
): Promise<UsageCheckResult> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  // Authenticated user
  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, messages_today, messages_today_reset_at")
      .eq("id", userId)
      .single();

    if (!profile) {
      return { allowed: true, currentUsage: 0, limit: 50, plan: "free" };
    }

    let messagesToday = profile.messages_today;

    // Reset counter if it's a new day
    if (profile.messages_today_reset_at < today) {
      await supabase
        .from("profiles")
        .update({ messages_today: 0, messages_today_reset_at: today })
        .eq("id", userId);
      messagesToday = 0;
    }

    const plan = getPlan(profile.plan);
    const limit = plan.limits.maxMessagesPerDay;

    if (messagesToday >= limit) {
      return {
        allowed: false,
        reason: `You've hit your daily message limit. Upgrade to Pro for 2,000 messages/day.`,
        currentUsage: messagesToday,
        limit,
        plan: profile.plan,
      };
    }

    return { allowed: true, currentUsage: messagesToday, limit, plan: profile.plan };
  }

  // Anonymous user — track by session_id
  if (sessionId) {
    const { data: usage } = await supabase
      .from("anonymous_usage")
      .select("messages_today, messages_today_reset_at")
      .eq("session_id", sessionId)
      .single();

    let messagesToday = 0;

    if (usage) {
      messagesToday = usage.messages_today;
      if (usage.messages_today_reset_at < today) {
        await supabase
          .from("anonymous_usage")
          .update({ messages_today: 0, messages_today_reset_at: today })
          .eq("session_id", sessionId);
        messagesToday = 0;
      }
    }

    const plan = getPlan("free");
    const limit = plan.limits.maxMessagesPerDay;

    if (messagesToday >= limit) {
      return {
        allowed: false,
        reason: `You've hit your daily message limit. Upgrade to Pro for 2,000 messages/day.`,
        currentUsage: messagesToday,
        limit,
        plan: "free",
      };
    }

    return { allowed: true, currentUsage: messagesToday, limit, plan: "free" };
  }

  // No identity at all — allow with free limits
  return { allowed: true, currentUsage: 0, limit: 50, plan: "free" };
}

export async function incrementUsage(
  userId: string | undefined,
  sessionId: string | undefined
): Promise<void> {
  const supabase = createAdminClient();

  if (userId) {
    await supabase.rpc("increment_profile_messages", { p_user_id: userId });
    return;
  }

  if (sessionId) {
    await supabase.rpc("increment_anonymous_messages", { p_session_id: sessionId });
  }
}

export async function checkAgentLimit(
  userId: string | undefined,
  sessionId: string | undefined
): Promise<AgentLimitResult> {
  const supabase = createAdminClient();
  const plan = getPlan("free");
  let limit = plan.limits.maxAgents;

  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", userId)
      .single();

    if (profile) {
      limit = getPlan(profile.plan).limits.maxAgents;
    }

    const { count } = await supabase
      .from("agents")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId);

    return { allowed: (count || 0) < limit, currentCount: count || 0, limit };
  }

  if (sessionId) {
    const { count } = await supabase
      .from("agents")
      .select("id", { count: "exact", head: true })
      .eq("temp_session_id", sessionId);

    return { allowed: (count || 0) < limit, currentCount: count || 0, limit };
  }

  return { allowed: true, currentCount: 0, limit };
}
