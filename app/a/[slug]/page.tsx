"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AgentConfig } from "@/lib/types/agent";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(false);

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

      // Show welcome message
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

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Get session_id from cookie
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
            }

            if (data.error) {
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

      // Mark streaming complete
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

  // Share URL
  function handleShare() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // 404
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

  // Loading
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
        <button
          onClick={handleShare}
          className="shrink-0 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          {copied ? "Copied!" : "Share"}
        </button>
      </header>

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
            placeholder="Type a message..."
            disabled={sending}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
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
      </div>
    </div>
  );
}
