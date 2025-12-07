create table if not exists public.calendar_events (
    id uuid default gen_random_uuid() primary key,
    calendar_connection_id uuid references public.calendar_connections(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    external_id text not null,
    title text not null,
    description text,
    start_at timestamptz not null,
    end_at timestamptz not null,
    location text,
    all_day boolean default false,
    event_data jsonb default '{}'::jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Add indexes
create index if not exists calendar_events_user_id_idx on public.calendar_events(user_id);
create index if not exists calendar_events_connection_id_idx on public.calendar_events(calendar_connection_id);
create index if not exists calendar_events_start_at_idx on public.calendar_events(start_at);

-- Enable RLS
alter table public.calendar_events enable row level security;

-- Add RLS policies
create policy "Users can view their own calendar events"
    on public.calendar_events for select
    using (auth.uid() = user_id);

create policy "Users can insert their own calendar events"
    on public.calendar_events for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own calendar events"
    on public.calendar_events for update
    using (auth.uid() = user_id);

create policy "Users can delete their own calendar events"
    on public.calendar_events for delete
    using (auth.uid() = user_id);
