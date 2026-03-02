"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

const USE_CASES = [
  {
    label: "Answering customer questions",
    icon: "M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z",
    prompt: "I want a customer support agent that answers questions about my product, handles common issues, and escalates complex problems. It should be friendly, accurate, and always try to resolve issues on the first message.",
    color: "from-blue-500 to-cyan-500",
  },
  {
    label: "Finding leads & writing outreach",
    icon: "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z",
    prompt: "I want a sales agent that identifies potential leads, researches their company, and writes personalized cold outreach emails. It should follow proven sales frameworks like AIDA and adapt tone based on the industry.",
    color: "from-emerald-500 to-teal-500",
  },
  {
    label: "Teaching or tutoring",
    icon: "M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5",
    prompt: "I want a tutoring agent that explains concepts clearly, adapts to the student's level, asks follow-up questions to check understanding, and provides practice problems with step-by-step feedback.",
    color: "from-amber-500 to-orange-500",
  },
  {
    label: "Creating content & social posts",
    icon: "m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10",
    prompt: "I want a content creation agent that generates social media posts, blog outlines, and marketing copy. It should match my brand voice, suggest relevant hashtags, and create weekly content calendars.",
    color: "from-pink-500 to-rose-500",
  },
  {
    label: "Analyzing data & research",
    icon: "M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6",
    prompt: "I want a research agent that analyzes data, summarizes findings, identifies trends, and creates clear reports. It should be thorough, cite sources when possible, and present actionable insights.",
    color: "from-violet-500 to-purple-500",
  },
  {
    label: "Something else entirely",
    icon: "M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z",
    prompt: "",
    color: "from-indigo-500 to-purple-500",
  },
];

export default function Home() {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [spawnPulse, setSpawnPulse] = useState(false);
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleUseCaseClick(prompt: string) {
    if (prompt) {
      setDescription(prompt);
    }
    textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      textareaRef.current?.focus();
      setSpawnPulse(true);
      setTimeout(() => setSpawnPulse(false), 2000);
    }, 400);
  }

  async function handleSpawn() {
    const trimmed = description.trim();
    if (!trimmed) {
      setError("Please describe your agent first.");
      return;
    }
    if (trimmed.length > 2000) {
      setError("Description must be under 2000 characters.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Read temp_session_id from cookie (set by middleware)
      const sessionId = document.cookie
        .split("; ")
        .find((row) => row.startsWith("temp_session_id="))
        ?.split("=")[1];

      // Generate config + save agent server-side
      const res = await fetch("/api/generate-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: trimmed, session_id: sessionId }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.limitReached) {
          setError(data.error);
          setLoading(false);
          return;
        }
        throw new Error(data.error || "Failed to generate agent config");
      }

      const { slug } = await res.json();

      // Redirect to agent page
      router.push(`/a/${slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Hero */}
      <main className="flex flex-col items-center justify-center px-6 pt-20 pb-20">
        <div className="w-full max-w-3xl text-center">
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
            Spawn Your{" "}
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              AI Agent
            </span>
          </h1>

          <p className="mt-6 text-lg text-slate-400 sm:text-xl max-w-2xl mx-auto">
            Describe what you want. Get a working AI agent in 60 seconds.
            No&nbsp;code. No&nbsp;API&nbsp;keys. Just results.
          </p>

          {/* Input */}
          <div className="mt-12 relative group">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 blur-lg group-focus-within:from-indigo-500/40 group-focus-within:to-purple-500/40 transition-all duration-300" />
            <textarea
              ref={textareaRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="I want an agent that..."
              rows={4}
              disabled={loading}
              className="relative w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-6 py-5 text-lg text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-50 backdrop-blur"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleSpawn();
                }
              }}
            />
          </div>

          {error && (
            <p className="mt-4 text-red-400 text-sm">{error}</p>
          )}

          <button
            onClick={handleSpawn}
            disabled={loading}
            className={`mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:from-indigo-400 hover:to-purple-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${spawnPulse ? "animate-pulse ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-950" : ""}`}
          >
            {loading ? (
              <>
                <LoadingSpinner />
                Spawning your agent...
              </>
            ) : (
              "Spawn Agent \u2726"
            )}
          </button>

          <p className="mt-4 text-sm text-slate-600">
            Ctrl+Enter to spawn
          </p>
        </div>
      </main>

      {/* Use Case Cards */}
      <section className="px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-2xl font-bold text-white sm:text-3xl">
            What&apos;s your worst task?
          </h2>
          <p className="mt-3 text-center text-slate-400 max-w-xl mx-auto">
            Pick one and we&apos;ll build you an AI agent for it. Or describe your own.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {USE_CASES.map((uc) => (
              <button
                key={uc.label}
                onClick={() => handleUseCaseClick(uc.prompt)}
                className="group flex items-start gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-left hover:border-slate-600 hover:bg-slate-800/50 transition-all duration-200"
              >
                <div className={`shrink-0 mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${uc.color} bg-opacity-20`}>
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={uc.icon} />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-white group-hover:text-indigo-300 transition-colors">
                    {uc.label}
                  </p>
                  {uc.prompt && (
                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                      {uc.prompt.slice(0, 80)}...
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 border-t border-slate-800/50">
        <div className="max-w-5xl mx-auto grid gap-8 sm:grid-cols-3">
          <FeatureCard
            title="Real Memory"
            description="Your agent remembers every conversation. It learns your preferences, tracks progress, and gets better over time."
            icon={
              <svg
                className="w-8 h-8 text-indigo-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z"
                />
              </svg>
            }
          />
          <FeatureCard
            title="Expert Skills"
            description="Built-in skill library with proven frameworks. Your agent follows real methodologies — not generic prompts."
            icon={
              <svg
                className="w-8 h-8 text-purple-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342"
                />
              </svg>
            }
          />
          <FeatureCard
            title="Share Anywhere"
            description="Every agent gets a unique URL. Share it with anyone — they can start chatting instantly, no signup required."
            icon={
              <svg
                className="w-8 h-8 text-sky-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
                />
              </svg>
            }
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 border-t border-slate-800/50 text-center text-sm text-slate-600">
        Built with &#9829; and frontier AI &middot;{" "}
        <a
          href="https://x.com/Skunkworks0x"
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-500 hover:text-slate-400 transition-colors"
        >
          @Skunkworks0x
        </a>
      </footer>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-white">{title}</h3>
      <p className="mt-2 text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
