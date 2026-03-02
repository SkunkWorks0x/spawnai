import Link from "next/link";

export default function BillingSuccess() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white px-6">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-purple-600">
          <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold">Welcome to SpawnAI Pro!</h1>
        <p className="mt-4 text-slate-400 leading-relaxed">
          Your upgrade is active. You now have access to more agents, more messages, and premium features. Go spawn some agents.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white hover:from-indigo-400 hover:to-purple-500 transition-colors"
          >
            Spawn an Agent
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
