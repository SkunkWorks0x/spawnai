"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for trying out SpawnAI",
    badge: null,
    features: [
      "3 AI agents",
      "50 messages/day",
      "2 skills per agent",
      "Embed widget",
      "SpawnAI branding",
      "Community support",
    ],
    cta: "Get Started",
    ctaLink: "/",
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For creators and small teams",
    badge: "Most Popular",
    features: [
      "25 AI agents",
      "2,000 messages/day",
      "All 20+ expert skills",
      "Embed widget",
      "Remove SpawnAI branding",
      "Analytics dashboard",
      "Email support",
    ],
    cta: "Start Pro Trial",
    ctaAction: "pro",
    highlighted: true,
  },
  {
    id: "business",
    name: "Business",
    price: "$99",
    period: "/month",
    description: "For teams and enterprises",
    badge: null,
    features: [
      "Unlimited agents",
      "10,000 messages/day",
      "All 20+ expert skills",
      "Embed widget + API access",
      "Custom branding",
      "Full analytics + export",
      "Team collaboration",
      "Priority support",
    ],
    cta: "Start Business Trial",
    ctaAction: "business",
    highlighted: false,
  },
];

const faqs = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel your subscription at any time from your dashboard. You'll keep access until the end of your billing period.",
  },
  {
    q: "What happens when I hit my limit?",
    a: "You can upgrade your plan for more messages, or wait until tomorrow when your daily limit resets at midnight UTC.",
  },
  {
    q: "Do you offer annual pricing?",
    a: "Coming soon! Annual plans will save you 20% compared to monthly billing.",
  },
  {
    q: "Can I switch plans?",
    a: "Absolutely. Upgrade or downgrade at any time. Changes take effect immediately and billing is prorated.",
  },
];

const comparison = [
  { feature: "AI Agents", free: "3", pro: "25", business: "Unlimited" },
  { feature: "Messages/Day", free: "50", pro: "2,000", business: "10,000" },
  { feature: "Skills per Agent", free: "2", pro: "4", business: "4" },
  { feature: "Embed Widget", free: "Yes", pro: "Yes", business: "Yes" },
  { feature: "Custom Branding", free: "No", pro: "Yes", business: "Yes" },
  { feature: "Analytics", free: "No", pro: "Yes", business: "Yes + Export" },
  { feature: "API Access", free: "No", pro: "No", business: "Yes" },
  { feature: "Support", free: "Community", pro: "Email", business: "Priority" },
];

export default function PricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleCheckout(plan: string) {
    setLoading(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error === "auth_required") {
        router.push("/auth/login?next=/pricing");
      } else {
        alert(data.error || "Something went wrong");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="text-center pt-20 pb-12 px-6">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Simple, transparent{" "}
          <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            pricing
          </span>
        </h1>
        <p className="mt-4 text-lg text-slate-400 max-w-xl mx-auto">
          Start free. Upgrade when you need more power. No hidden fees.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border p-8 flex flex-col ${
                plan.highlighted
                  ? "border-indigo-500 bg-slate-900/80 shadow-lg shadow-indigo-500/10"
                  : "border-slate-800 bg-slate-900/50"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-semibold px-4 py-1 rounded-full">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <p className="text-sm text-slate-400 mt-1">{plan.description}</p>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-slate-400 ml-1">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-slate-300">
                    <svg className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              {plan.ctaLink ? (
                <Link
                  href={plan.ctaLink}
                  className={`w-full rounded-xl py-3 text-center text-sm font-semibold transition-colors ${
                    plan.highlighted
                      ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-400 hover:to-purple-500"
                      : "bg-slate-800 text-white hover:bg-slate-700 border border-slate-700"
                  }`}
                >
                  {plan.cta}
                </Link>
              ) : (
                <button
                  onClick={() => handleCheckout(plan.ctaAction!)}
                  disabled={loading === plan.ctaAction}
                  className={`w-full rounded-xl py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${
                    plan.highlighted
                      ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-400 hover:to-purple-500"
                      : "bg-slate-800 text-white hover:bg-slate-700 border border-slate-700"
                  }`}
                >
                  {loading === plan.ctaAction ? "Loading..." : plan.cta}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Feature Comparison */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold text-center mb-8">Compare Plans</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Feature</th>
                <th className="text-center py-3 px-4 text-slate-400 font-medium">Free</th>
                <th className="text-center py-3 px-4 text-indigo-400 font-medium">Pro</th>
                <th className="text-center py-3 px-4 text-slate-400 font-medium">Business</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.feature} className="border-b border-slate-800/50">
                  <td className="py-3 px-4 text-slate-300">{row.feature}</td>
                  <td className="py-3 px-4 text-center text-slate-400">{row.free}</td>
                  <td className="py-3 px-4 text-center text-white font-medium">{row.pro}</td>
                  <td className="py-3 px-4 text-center text-slate-300">{row.business}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {faqs.map((faq) => (
            <div key={faq.q} className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <h3 className="font-semibold text-white">{faq.q}</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="px-6 py-12 border-t border-slate-800/50 text-center text-sm text-slate-600">
        Built with &#9829; and frontier AI &middot;{" "}
        <Link href="/" className="text-slate-500 hover:text-slate-400 transition-colors">
          SpawnAI
        </Link>
      </footer>
    </div>
  );
}
