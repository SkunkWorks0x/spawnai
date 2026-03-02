"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { AgentConfig } from "@/lib/types/agent";

interface AgentRow {
  id: string;
  slug: string;
  config: AgentConfig;
  status: string;
  total_messages: number;
  total_conversations: number;
  created_at: string;
}

interface ProfileData {
  plan: string;
  messages_today: number;
  messages_today_reset_at: string;
  stripe_subscription_id: string | null;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const planLimits: Record<string, { messages: number; agents: number }> = {
  free: { messages: 50, agents: 3 },
  pro: { messages: 2000, agents: 25 },
  business: { messages: 10000, agents: 999 },
};

export default function Dashboard() {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login?next=/dashboard");
        return;
      }

      const [agentsRes, profileRes] = await Promise.all([
        supabase
          .from("agents")
          .select("id, slug, config, status, total_messages, total_conversations, created_at")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("plan, messages_today, messages_today_reset_at, stripe_subscription_id")
          .eq("id", user.id)
          .single(),
      ]);

      setAgents((agentsRes.data as AgentRow[]) || []);
      setProfile(profileRes.data as ProfileData);
      setLoading(false);
    }

    load();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-500" />
      </div>
    );
  }

  const plan = profile?.plan || "free";
  const limits = planLimits[plan] || planLimits.free;
  const messagesToday = profile?.messages_today || 0;
  const messagePercent = Math.min(100, (messagesToday / limits.messages) * 100);
  const agentPercent = Math.min(100, (agents.length / limits.agents) * 100);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-2 text-slate-400">Manage your agents, usage, and plan.</p>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          {/* Plan */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <p className="text-sm text-slate-400">Current Plan</p>
            <p className="mt-1 text-2xl font-bold capitalize">{plan}</p>
            {plan === "free" ? (
              <Link
                href="/pricing"
                className="mt-3 inline-block text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Upgrade &rarr;
              </Link>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                Subscription active
              </p>
            )}
          </div>

          {/* Messages Today */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <p className="text-sm text-slate-400">Messages Today</p>
            <p className="mt-1 text-2xl font-bold">
              {messagesToday}
              <span className="text-sm font-normal text-slate-500"> / {limits.messages.toLocaleString()}</span>
            </p>
            <div className="mt-3 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  messagePercent > 80 ? "bg-amber-500" : "bg-indigo-500"
                }`}
                style={{ width: `${messagePercent}%` }}
              />
            </div>
          </div>

          {/* Agents */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <p className="text-sm text-slate-400">Agents</p>
            <p className="mt-1 text-2xl font-bold">
              {agents.length}
              <span className="text-sm font-normal text-slate-500">
                {" "}/ {limits.agents >= 999 ? "Unlimited" : limits.agents}
              </span>
            </p>
            <div className="mt-3 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${agentPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3 mt-8">
          <Link
            href="/"
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:from-indigo-400 hover:to-purple-500 transition-colors"
          >
            Spawn New Agent
          </Link>
          <Link
            href="/pricing"
            className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            View Pricing
          </Link>
        </div>

        {/* Agents List */}
        <div className="mt-12">
          <h2 className="text-xl font-semibold mb-4">My Agents</h2>
          {agents.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center">
              <p className="text-slate-400">No agents yet. Spawn your first one!</p>
              <Link
                href="/"
                className="mt-4 inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
              >
                Create Agent
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 hover:bg-slate-800/50 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link href={`/a/${agent.slug}`} className="font-semibold text-white hover:text-indigo-300 transition-colors truncate">
                          {agent.config.name}
                        </Link>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                            agent.status === "active"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : agent.status === "temp"
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-slate-500/10 text-slate-400"
                          }`}
                        >
                          {agent.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 truncate mt-0.5">
                        {agent.config.short_description}
                      </p>
                    </div>
                    <span className="text-xs text-slate-600 shrink-0">{timeAgo(agent.created_at)}</span>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span>{agent.total_messages || 0} messages</span>
                      <span>{agent.total_conversations || 0} conversations</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/a/${agent.slug}`}
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                      >
                        Chat
                      </Link>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/a/${agent.slug}`);
                        }}
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                      >
                        Copy Link
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
