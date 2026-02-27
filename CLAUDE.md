# SpawnAI

## What This Is
SpawnAI is a platform where anyone can describe an AI agent in plain English and have a working, shareable agent live in under 60 seconds. "Pump.fun but for AI agents."

## Architecture
- Hybrid model strategy: Claude Sonnet 4.5 for config generation, Grok-4.1-Fast for agent runtime
- Next.js 14 (App Router) + Supabase (auth, postgres, pgvector, edge functions) + Vercel
- Streaming SSE for real-time chat
- Anonymous-to-authenticated conversion via temp_session_id cookies

## Key Technical Decisions
- Agent configs stored as JSONB in Supabase
- Skills are structured text injected into system prompts (max 4 per agent)
- Memory via pgvector with cosine similarity search
- Multi-turn tool execution loop (max 3 iterations per message)
- Checklist-based self-evaluation with confidence scoring
- Model escalation: Grok-4.1-Fast → Grok-4 if confidence < 70 on 3 consecutive turns
- RLS enforced on all tables

## Stack
- Frontend: Next.js 14, TypeScript, Tailwind CSS
- Database: Supabase (PostgreSQL + pgvector + Auth + Edge Functions)
- Config Generation: Anthropic API (Claude Sonnet 4.5)
- Agent Runtime: xAI API (Grok-4.1-Fast-Reasoning)
- Payments: Stripe (later)
- Deploy: Vercel (frontend), Supabase (backend)

## API Keys
All keys are in .env.local — never hardcode them, never commit them.

## Coding Standards
- TypeScript strict mode
- All database queries use Supabase client with RLS
- Server-side operations use SUPABASE_SERVICE_ROLE_KEY
- Client-side uses NEXT_PUBLIC_SUPABASE_ANON_KEY
- All API routes handle errors gracefully with proper status codes
- SSE streaming for all chat responses
- httpOnly Secure SameSite=Lax cookies for temp_session_id

## File Structure
- app/ — Next.js pages and API routes
- lib/agents/ — Core agent logic (config gen, runtime, tools, memory, self-eval)
- lib/supabase/ — Supabase client helpers
- lib/types/ — TypeScript interfaces
- lib/utils/ — Helpers (cost calculation, slug generation)
- supabase/migrations/ — Database migrations
