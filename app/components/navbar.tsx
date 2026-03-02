"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

// Pages that handle their own nav or shouldn't show the global navbar
const HIDDEN_PATHS = ["/auth/login", "/auth/signup", "/a/", "/embed-preview/"];

export default function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const hidden = HIDDEN_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  // Hide navbar on certain pages
  if (hidden) return null;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/";
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
        {/* Logo */}
        <Link href="/" className="text-xl font-bold text-white shrink-0">
          Spawn<span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">AI</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden sm:flex items-center gap-6">
          <Link
            href="/pricing"
            className={`text-sm transition-colors ${
              pathname === "/pricing" ? "text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Pricing
          </Link>

          {!loading && user ? (
            <>
              <Link
                href="/dashboard"
                className={`text-sm transition-colors ${
                  pathname === "/dashboard" ? "text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Dashboard
              </Link>
              <button
                onClick={handleSignOut}
                className="rounded-lg border border-slate-700 px-4 py-1.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                Sign Out
              </button>
            </>
          ) : !loading ? (
            <Link
              href="/auth/login"
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
            >
              Sign In
            </Link>
          ) : null}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="sm:hidden text-slate-400 hover:text-white p-1"
          aria-label="Menu"
        >
          {menuOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-slate-800 bg-slate-950 px-6 py-4 space-y-3">
          <Link
            href="/pricing"
            onClick={() => setMenuOpen(false)}
            className="block text-sm text-slate-300 hover:text-white"
          >
            Pricing
          </Link>
          {!loading && user ? (
            <>
              <Link
                href="/dashboard"
                onClick={() => setMenuOpen(false)}
                className="block text-sm text-slate-300 hover:text-white"
              >
                Dashboard
              </Link>
              <button
                onClick={handleSignOut}
                className="block text-sm text-slate-300 hover:text-white"
              >
                Sign Out
              </button>
            </>
          ) : !loading ? (
            <Link
              href="/auth/login"
              onClick={() => setMenuOpen(false)}
              className="block text-sm text-indigo-400 hover:text-indigo-300"
            >
              Sign In
            </Link>
          ) : null}
        </div>
      )}
    </nav>
  );
}
