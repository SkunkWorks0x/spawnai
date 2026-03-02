"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AgentConfig } from "@/lib/types/agent";
import QRCode from "qrcode";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

type Tab = "chat" | "embed";

interface UsageInfo {
  currentUsage: number;
  limit: number;
  plan: string;
}

export default function AgentChat() {
  const params = useParams();
  const slug = params.slug as string;

  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [limitReached, setLimitReached] = useState(false);
  const [usage, setUsage] = useState<UsageInfo | null>(null);

  // Embed panel state
  const [spawnTime, setSpawnTime] = useState<string | null>(null);
  const [showSpawnBadge, setShowSpawnBadge] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [embedColor, setEmbedColor] = useState("#6366f1");
  const [embedPosition, setEmbedPosition] = useState("bottom-right");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(false);

  const appUrl = typeof window !== "undefined" ? window.location.origin : "https://spawnai.vercel.app";
  const agentUrl = `${appUrl}/a/${slug}`;

  // Check for spawn timing badge
  useEffect(() => {
    const startStr = sessionStorage.getItem("spawnai_spawn_start");
    if (startStr) {
      const elapsed = (Date.now() - parseInt(startStr, 10)) / 1000;
      if (elapsed < 30) {
        setSpawnTime(elapsed.toFixed(1));
        setShowSpawnBadge(true);
        setTimeout(() => setShowSpawnBadge(false), 3000);
      }
      sessionStorage.removeItem("spawnai_spawn_start");
    }
  }, []);

  // Load agent config
  useEffect(() => {
    async function loadAgent() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("agents")
        .select("config, status")
        .eq("slug", slug)
        .single();

      if (error || !data || data.status === "suspended") {
        setNotFound(true);
        return;
      }

      const agentConfig = data.config as AgentConfig;
      setConfig(agentConfig);

      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: agentConfig.welcome_message,
        },
      ]);
    }

    loadAgent();
  }, [slug]);

  // Generate QR code when embed tab opens
  useEffect(() => {
    if (activeTab === "embed" && !qrDataUrl) {
      QRCode.toDataURL(agentUrl, {
        width: 200,
        margin: 2,
        color: { dark: "#e2e8f0", light: "#0f172a" },
      }).then(setQrDataUrl).catch(() => {});
    }
  }, [activeTab, agentUrl, qrDataUrl]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getSessionId = useCallback(() => {
    return document.cookie
      .split("; ")
      .find((row) => row.startsWith("temp_session_id="))
      ?.split("=")[1];
  }, []);

  // Send message
  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sendingRef.current) return;
    sendingRef.current = true;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    const assistantMsgId = crypto.randomUUID();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_slug: slug,
          message: trimmed,
          conversation_id: conversationId,
          session_id: getSessionId(),
        }),
      });

      if (!res.ok) {
        throw new Error("Chat request failed");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(trimmedLine.slice(6));

            if (data.error === "limit_reached") {
              setLimitReached(true);
              setUsage({
                currentUsage: data.currentUsage,
                limit: data.limit,
                plan: data.plan,
              });
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: data.message, streaming: false }
                    : m
                )
              );
              continue;
            }

            if (data.text) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: m.content + data.text }
                    : m
                )
              );
            }

            if (data.done) {
              if (data.conversation_id) {
                setConversationId(data.conversation_id);
              }
              if (data.usage) {
                setUsage(data.usage);
              }
            }

            if (data.error && data.error !== "limit_reached") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content:
                          m.content ||
                          "Sorry, something went wrong. Please try again.",
                        streaming: false,
                      }
                    : m
                )
              );
            }
          } catch {
            // Skip unparseable lines
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, streaming: false } : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: m.content || "Connection error. Please try again.",
                streaming: false,
              }
            : m
        )
      );
    } finally {
      sendingRef.current = false;
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function getEmbedSnippet() {
    let tag = `<script src="${appUrl}/embed.js" data-agent="${slug}"`;
    if (embedColor !== "#6366f1") tag += ` data-color="${embedColor}"`;
    if (embedPosition !== "bottom-right") tag += ` data-position="${embedPosition}"`;
    tag += `></script>`;
    return tag;
  }

  function copyEmbed() {
    navigator.clipboard.writeText(getEmbedSnippet());
    setEmbedCopied(true);
    setTimeout(() => setEmbedCopied(false), 2000);
  }

  function copyLink() {
    navigator.clipboard.writeText(agentUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <h1 className="text-4xl font-bold">Agent not found</h1>
          <p className="mt-4 text-slate-400">
            This agent doesn&apos;t exist or has been suspended.
          </p>
          <a
            href="/"
            className="mt-6 inline-block rounded-full bg-indigo-600 px-6 py-3 text-sm font-medium hover:bg-indigo-500 transition-colors"
          >
            Create your own agent
          </a>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-500" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-white">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <a href="/" className="text-slate-500 hover:text-white transition-colors shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </a>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate">{config.name}</h1>
            <p className="text-sm text-slate-500 truncate">
              {config.short_description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Spawn speed badge */}
          {showSpawnBadge && spawnTime && (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-400 animate-pulse">
              Spawned in {spawnTime}s
            </span>
          )}
          {/* Usage indicator */}
          {usage && (
            <div className="hidden sm:flex items-center gap-2 mr-2 text-xs text-slate-400">
              <span>{usage.currentUsage}/{usage.limit}</span>
              <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usage.currentUsage / usage.limit > 0.8
                      ? "bg-amber-500"
                      : "bg-indigo-500"
                  }`}
                  style={{ width: `${Math.min(100, (usage.currentUsage / usage.limit) * 100)}%` }}
                />
              </div>
            </div>
          )}
          <button
            onClick={() => setActiveTab(activeTab === "embed" ? "chat" : "embed")}
            className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
              activeTab === "embed"
                ? "border-indigo-500 bg-indigo-600/20 text-indigo-300"
                : "border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
              </svg>
              Embed
            </span>
          </button>
          <button
            onClick={handleShare}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            {copied ? "Copied!" : "Share"}
          </button>
        </div>
      </header>

      {activeTab === "chat" ? (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-800 text-slate-100"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-relaxed sm:text-base">
                      {msg.content}
                      {msg.streaming && !msg.content && (
                        <span className="inline-flex gap-1">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500 [animation-delay:-0.3s]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500 [animation-delay:-0.15s]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500" />
                        </span>
                      )}
                      {msg.streaming && msg.content && (
                        <span className="inline-block h-4 w-0.5 ml-0.5 animate-pulse bg-slate-400" />
                      )}
                    </p>
                  </div>
                </div>
              ))}

              {/* Upgrade banner */}
              {limitReached && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
                  <p className="text-sm text-amber-200 leading-relaxed">
                    You&apos;ve used all {usage?.limit || 50} free messages today. Your agent is ready to keep helping — upgrade to Pro for 2,000 messages/day.
                  </p>
                  <a
                    href="/pricing"
                    className="mt-3 inline-block rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2 text-sm font-semibold text-white hover:from-indigo-400 hover:to-purple-500 transition-colors"
                  >
                    Upgrade Now
                  </a>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-slate-800 px-4 py-4 sm:px-6">
            <div className="mx-auto flex max-w-3xl gap-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={limitReached ? "Daily limit reached" : "Type a message..."}
                disabled={sending || limitReached}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={sending || !input.trim() || limitReached}
                className="shrink-0 rounded-xl bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
                  />
                </svg>
              </button>
            </div>
            <div className="mx-auto max-w-3xl mt-2 text-center">
              <a
                href={`${appUrl}/?ref=agent&agent=${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
              >
                Powered by SpawnAI
              </a>
            </div>
          </div>
        </>
      ) : (
        /* ── Embed Panel ─────────────────────────────────────────── */
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-3xl space-y-8">

            <section>
              <h2 className="text-lg font-semibold text-white mb-1">Embed Code</h2>
              <p className="text-sm text-slate-400 mb-4">
                Add this script tag to any website to embed your agent as a chat widget.
              </p>
              <div className="relative">
                <pre className="rounded-xl bg-slate-900 border border-slate-700 p-4 text-sm text-indigo-300 overflow-x-auto whitespace-pre-wrap break-all">
                  {getEmbedSnippet()}
                </pre>
                <button
                  onClick={copyEmbed}
                  className="absolute top-3 right-3 rounded-lg bg-slate-800 border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  {embedCopied ? "Copied!" : "Copy"}
                </button>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-1">Customization</h2>
              <p className="text-sm text-slate-400 mb-4">
                Adjust the widget appearance. The embed code above updates automatically.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Brand Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={embedColor}
                      onChange={(e) => setEmbedColor(e.target.value)}
                      className="h-10 w-10 rounded-lg border border-slate-700 bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={embedColor}
                      onChange={(e) => setEmbedColor(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Position</label>
                  <select
                    value={embedPosition}
                    onChange={(e) => setEmbedPosition(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white"
                  >
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Direct Link</h2>
                <p className="text-sm text-slate-400 mb-4">Share this URL to let anyone chat with your agent.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={agentUrl}
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 font-mono truncate"
                  />
                  <button
                    onClick={copyLink}
                    className="shrink-0 rounded-lg bg-slate-800 border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    {linkCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">QR Code</h2>
                <p className="text-sm text-slate-400 mb-4">Scan to open the agent on mobile.</p>
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Agent QR Code" className="w-[140px] h-[140px] rounded-lg" />
                ) : (
                  <div className="w-[140px] h-[140px] rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-500" />
                  </div>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-1">Live Preview</h2>
              <p className="text-sm text-slate-400 mb-4">
                See how the widget looks on a website.
              </p>
              <div className="rounded-xl border border-slate-700 overflow-hidden bg-white">
                <iframe
                  src={`/embed-preview/${slug}?color=${encodeURIComponent(embedColor)}&position=${embedPosition}`}
                  className="w-full h-[500px] border-0"
                  title="Widget Preview"
                />
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
