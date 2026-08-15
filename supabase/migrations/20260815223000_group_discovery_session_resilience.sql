alter table public.group_discovery_states
  add column if not exists selected_keywords text[] not null default '{}',
  add column if not exists current_keyword text,
  add column if not exists duplicates_found integer not null default 0,
  add column if not exists errors jsonb not null default '[]'::jsonb;

update public.group_discovery_states
set selected_keywords = keywords
where selected_keywords = '{}'::text[]
  and keywords is not null;
