-- Create User Preferences Table
create table if not exists public.user_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  conflict_resolution_style text check (conflict_resolution_style in ('aggressive', 'balanced', 'conservative')) default 'balanced',
  working_hours_start time default '09:00',
  working_hours_end time default '17:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id)
);

-- Enable RLS
alter table public.user_preferences enable row level security;

-- Create Policy: Users can view their own preferences
create policy "Users can view their own preferences"
  on public.user_preferences for select
  using (auth.uid() = user_id);

-- Create Policy: Users can update their own preferences
create policy "Users can update their own preferences"
  on public.user_preferences for update
  using (auth.uid() = user_id);

-- Create Policy: Users can insert their own preferences
create policy "Users can insert their own preferences"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);
