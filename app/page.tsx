"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

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
      <main className="flex flex-col items-center justify-center px-6 pt-32 pb-20">
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
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:from-indigo-400 hover:to-purple-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
