-- Create bundle_suggestions table
create table if not exists public.bundle_suggestions (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    anchor_event_id text, -- ID of the fixed meeting (optional)
    included_item_ids text[] not null default '{}', -- IDs of errands/tasks in this bundle
    suggested_start_at timestamptz not null,
    suggested_end_at timestamptz not null,
    total_duration_min int not null,
    route_sequence text[] not null default '{}', -- Ordered list of locations
    reasoning text, -- AI explanation
    status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
    confidence_score float, -- 0.0 - 1.0 score
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Add indexes
create index if not exists bundle_suggestions_user_id_idx on public.bundle_suggestions(user_id);
create index if not exists bundle_suggestions_created_at_idx on public.bundle_suggestions(created_at);
create index if not exists bundle_suggestions_status_idx on public.bundle_suggestions(status);

-- Enable RLS
alter table public.bundle_suggestions enable row level security;

-- Add RLS policies
create policy "Users can view their own bundle suggestions"
    on public.bundle_suggestions for select
    using (auth.uid() = user_id);

create policy "Users can insert their own bundle suggestions"
    on public.bundle_suggestions for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own bundle suggestions"
    on public.bundle_suggestions for update
    using (auth.uid() = user_id);

create policy "Users can delete their own bundle suggestions"
    on public.bundle_suggestions for delete
    using (auth.uid() = user_id);

-- Grant access to authenticated users
grant all on public.bundle_suggestions to authenticated;
grant all on public.bundle_suggestions to service_role;
