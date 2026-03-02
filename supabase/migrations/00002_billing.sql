-- Add plan and billing columns to profiles
alter table profiles add column plan text not null default 'free' check (plan in ('free', 'pro', 'business'));
alter table profiles add column stripe_customer_id text;
alter table profiles add column stripe_subscription_id text;
alter table profiles add column plan_started_at timestamptz;
alter table profiles add column payment_status text not null default 'active' check (payment_status in ('active', 'past_due', 'cancelled'));
alter table profiles add column messages_today int not null default 0;
alter table profiles add column messages_today_reset_at date not null default current_date;

-- Daily message counter reset function
create or replace function reset_daily_messages()
returns void language plpgsql security definer as $$
begin
  update profiles
  set messages_today = 0, messages_today_reset_at = current_date
  where messages_today_reset_at < current_date;
end;
$$;

-- Indexes for billing lookups
create index idx_profiles_plan on profiles(plan);
create index idx_profiles_stripe on profiles(stripe_customer_id) where stripe_customer_id is not null;

-- Anonymous usage tracking table
create table if not exists anonymous_usage (
  session_id text primary key,
  messages_today int not null default 0,
  messages_today_reset_at date not null default current_date,
  created_at timestamptz not null default now()
);

-- RLS for anonymous_usage (service role only)
alter table anonymous_usage enable row level security;

-- RPC: increment authenticated user message count
create or replace function increment_profile_messages(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  update profiles
  set messages_today = messages_today + 1
  where id = p_user_id;
end;
$$;

-- RPC: increment anonymous user message count
create or replace function increment_anonymous_messages(p_session_id text)
returns void language plpgsql security definer as $$
begin
  insert into anonymous_usage (session_id, messages_today)
  values (p_session_id, 1)
  on conflict (session_id) do update
  set messages_today = anonymous_usage.messages_today + 1;
end;
$$;
