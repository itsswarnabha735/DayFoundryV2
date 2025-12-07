create table if not exists public.schedule_alerts (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('conflict', 'warning', 'suggestion')),
  message text not null,
  related_block_ids uuid[] default '{}',
  status text not null default 'pending' check (status in ('pending', 'dismissed', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (id)
);

-- Enable RLS
alter table public.schedule_alerts enable row level security;

-- Create Policy: Users can only see their own alerts
create policy "Users can view their own alerts"
  on public.schedule_alerts for select
  using (auth.uid() = user_id);

-- Create Policy: Users can update their own alerts (e.g. dismiss)
create policy "Users can update their own alerts"
  on public.schedule_alerts for update
  using (auth.uid() = user_id);

-- Create Policy: Service role can insert alerts (Edge Functions)
create policy "Service role can insert alerts"
  on public.schedule_alerts for insert
  with check (true);
