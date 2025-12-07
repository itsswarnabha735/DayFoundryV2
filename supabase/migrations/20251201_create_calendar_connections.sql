-- Create calendar_connections table
create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  provider text not null check (provider in ('google', 'outlook', 'ical')),
  external_id text, -- Google Calendar ID (usually email)
  access_token text, -- Encrypted/Secure
  refresh_token text, -- Encrypted/Secure
  token_expires_at timestamptz,
  sync_token text, -- For incremental sync
  resource_id text, -- Webhook resource ID
  channel_id text, -- Webhook channel ID
  channel_expiration timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  status text default 'active'
);

-- Enable RLS
alter table public.calendar_connections enable row level security;

-- RLS Policies
create policy "Users can view their own connections" on public.calendar_connections
  for select using (auth.uid() = user_id);

create policy "Users can insert their own connections" on public.calendar_connections
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own connections" on public.calendar_connections
  for update using (auth.uid() = user_id);

create policy "Users can delete their own connections" on public.calendar_connections
  for delete using (auth.uid() = user_id);

-- Create index for faster lookups
create index if not exists calendar_connections_user_id_idx on public.calendar_connections(user_id);
create index if not exists calendar_connections_provider_idx on public.calendar_connections(provider);
