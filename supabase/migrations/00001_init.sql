-- SpawnAI Database Schema
-- Initial migration: tables, indexes, RLS policies, functions, materialized view

-- ============================================================================
-- Extensions
-- ============================================================================

create extension if not exists vector;
create extension if not exists pg_cron;

-- ============================================================================
-- Tables
-- ============================================================================

-- profiles: User profile extending Supabase Auth
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- agents: Every spawned agent
create table agents (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users,
  slug text unique not null,
  config jsonb not null,
  status text not null default 'active' check (status in ('active', 'paused', 'suspended', 'temp')),
  public boolean default true,
  temp_session_id uuid,
  total_conversations int default 0,
  total_messages int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- conversations: Chat sessions between a user and an agent
create table conversations (
  id uuid default gen_random_uuid() primary key,
  agent_id uuid references agents on delete cascade not null,
  user_id uuid references auth.users,
  temp_session_id uuid,
  title text,
  model_override text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- messages: Individual messages within conversations
create table messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references conversations on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  model_used text,
  tokens_in int,
  tokens_out int,
  cost numeric(10,6),
  confidence_score int,
  created_at timestamptz default now()
);

-- memories: Long-term agent memory via vector embeddings
create table memories (
  id uuid default gen_random_uuid() primary key,
  agent_id uuid references agents on delete cascade not null,
  user_id uuid references auth.users,
  content text not null,
  embedding vector(1024),
  memory_type text default 'episodic' check (memory_type in ('episodic', 'semantic', 'summary')),
  metadata jsonb,
  created_at timestamptz default now()
);

-- usage_logs: Token and cost tracking for billing and analytics
create table usage_logs (
  id uuid default gen_random_uuid() primary key,
  agent_id uuid references agents on delete cascade,
  user_id uuid references auth.users,
  conversation_id uuid references conversations,
  tokens_in int not null,
  tokens_out int not null,
  cost numeric(10,6) not null,
  model text not null,
  escalated boolean default false,
  created_at timestamptz default now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

create index idx_agents_slug on agents(slug);
create index idx_agents_owner on agents(owner_id) where owner_id is not null;
create index idx_agents_temp_session on agents(temp_session_id) where temp_session_id is not null;
create index idx_agents_status on agents(status);
create index idx_conversations_agent on conversations(agent_id);
create index idx_conversations_user on conversations(user_id) where user_id is not null;
create index idx_conversations_temp on conversations(temp_session_id) where temp_session_id is not null;
create index idx_messages_conversation on messages(conversation_id);
create index idx_messages_created on messages(conversation_id, created_at);
create index idx_memories_embedding on memories using hnsw (embedding vector_cosine_ops);
create index idx_memories_agent_user on memories(agent_id, user_id);
create index idx_usage_agent on usage_logs(agent_id);
create index idx_usage_created on usage_logs(created_at);

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table profiles enable row level security;
alter table agents enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table memories enable row level security;
alter table usage_logs enable row level security;

-- Profiles
create policy "Users can view their own profile"
  on profiles for select using (auth.uid() = id);
create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);
create policy "Users can insert their own profile"
  on profiles for insert with check (auth.uid() = id);

-- Agents: public ones readable by anyone, owners have full access
create policy "Public agents are viewable by everyone"
  on agents for select using (public = true);
create policy "Users can manage their own agents"
  on agents for all using (auth.uid() = owner_id);
create policy "Temp agents accessible by session"
  on agents for select using (temp_session_id is not null);

-- Conversations: owner access + temp session access + public agent access
create policy "Users can access their own conversations"
  on conversations for all using (auth.uid() = user_id);
create policy "Temp session conversations"
  on conversations for all using (temp_session_id is not null);
create policy "Public agent conversations"
  on conversations for select using (
    exists (select 1 from agents where agents.id = conversations.agent_id and agents.public = true)
  );
create policy "Anyone can create conversations on public agents"
  on conversations for insert with check (
    exists (select 1 from agents where agents.id = agent_id and agents.public = true)
  );

-- Messages: accessible if user has access to the conversation
create policy "Users can read messages in their conversations"
  on messages for select using (
    exists (
      select 1 from conversations
      where conversations.id = messages.conversation_id
        and (conversations.user_id = auth.uid() or conversations.temp_session_id is not null)
    )
  );
create policy "Users can insert messages in their conversations"
  on messages for insert with check (
    exists (
      select 1 from conversations
      where conversations.id = messages.conversation_id
        and (conversations.user_id = auth.uid() or conversations.temp_session_id is not null)
    )
  );
create policy "Public agent messages readable"
  on messages for select using (
    exists (
      select 1 from conversations
      join agents on agents.id = conversations.agent_id
      where conversations.id = messages.conversation_id
        and agents.public = true
    )
  );

-- Memories: agent owner or associated user
create policy "Memory access"
  on memories for all using (
    auth.uid() = user_id or
    exists (select 1 from agents where agents.id = memories.agent_id and agents.owner_id = auth.uid())
  );

-- Usage logs: only agent owners
create policy "Usage visible to agent owners"
  on usage_logs for select using (
    exists (select 1 from agents where agents.id = usage_logs.agent_id and agents.owner_id = auth.uid())
  );

-- ============================================================================
-- Functions
-- ============================================================================

-- retrieve_relevant_memories: RPC function for vector similarity search
create or replace function retrieve_relevant_memories(
  p_agent_id uuid,
  p_user_id uuid,
  p_query_embedding vector(1024),
  p_limit int default 5
)
returns table (id uuid, content text, metadata jsonb, similarity float)
language plpgsql security definer as $$
begin
  return query
    select m.id, m.content, m.metadata,
           1 - (m.embedding <=> p_query_embedding) as similarity
    from memories m
    where m.agent_id = p_agent_id
      and (m.user_id = p_user_id or m.user_id is null)
    order by m.embedding <=> p_query_embedding
    limit p_limit;
end;
$$;

-- claim_temp_data: RPC for converting anonymous agent to owned
create or replace function claim_temp_data(
  p_temp_session_id uuid,
  p_user_id uuid
)
returns void
language plpgsql security definer as $$
begin
  -- Transfer agent ownership
  update agents
  set owner_id = p_user_id, status = 'active', temp_session_id = null, updated_at = now()
  where temp_session_id = p_temp_session_id and status = 'temp';

  -- Transfer conversations
  update conversations
  set user_id = p_user_id, temp_session_id = null, updated_at = now()
  where temp_session_id = p_temp_session_id;

  -- Transfer memories
  update memories
  set user_id = p_user_id
  where agent_id in (select id from agents where owner_id = p_user_id)
    and user_id is null;
end;
$$;

-- cleanup_temp_agents: Function for pg_cron to auto-delete unclaimed temp agents
create or replace function cleanup_temp_agents()
returns void
language plpgsql security definer as $$
begin
  delete from agents
  where status = 'temp'
    and created_at < now() - interval '48 hours';
end;
$$;

-- Schedule hourly cleanup (requires pg_cron extension)
select cron.schedule('cleanup-temp-agents', '0 * * * *', 'select cleanup_temp_agents()');

-- ============================================================================
-- Materialized View: Agent Stats
-- ============================================================================

create materialized view agent_stats as
select
  a.id as agent_id,
  count(distinct c.id) as total_conversations,
  count(distinct m.id) as total_messages,
  coalesce(avg(m.confidence_score), 0) as avg_confidence,
  coalesce(sum(u.cost), 0) as total_cost,
  count(case when u.escalated then 1 end) as escalation_count,
  max(m.created_at) as last_active
from agents a
left join conversations c on c.agent_id = a.id
left join messages m on m.conversation_id = c.id
left join usage_logs u on u.agent_id = a.id
group by a.id;

create unique index idx_agent_stats_id on agent_stats(agent_id);
