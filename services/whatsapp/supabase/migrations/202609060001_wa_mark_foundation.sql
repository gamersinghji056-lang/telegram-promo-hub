create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','manager','agent','viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.whatsapp_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null default 'meta_cloud',
  waba_id text,
  phone_number_id text,
  display_phone_number text,
  verified_name text,
  status text not null default 'disconnected' check (status in ('disconnected','connecting','connected','error')),
  token_secret_ref text,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workspace_members_user on public.workspace_members(user_id);
create index if not exists idx_whatsapp_accounts_workspace on public.whatsapp_accounts(workspace_id);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.whatsapp_accounts enable row level security;

drop policy if exists "profile self read" on public.profiles;
create policy "profile self read" on public.profiles for select using (auth.uid() = id);

drop policy if exists "profile self update" on public.profiles;
create policy "profile self update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "workspace member read" on public.workspaces;
create policy "workspace member read" on public.workspaces for select using (
  exists (
    select 1 from public.workspace_members m
    where m.workspace_id = workspaces.id and m.user_id = auth.uid()
  )
);

drop policy if exists "workspace members read" on public.workspace_members;
create policy "workspace members read" on public.workspace_members for select using (
  exists (
    select 1 from public.workspace_members self_member
    where self_member.workspace_id = workspace_members.workspace_id
      and self_member.user_id = auth.uid()
  )
);

drop policy if exists "whatsapp account member read" on public.whatsapp_accounts;
create policy "whatsapp account member read" on public.whatsapp_accounts for select using (
  exists (
    select 1 from public.workspace_members m
    where m.workspace_id = whatsapp_accounts.workspace_id and m.user_id = auth.uid()
  )
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles(id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.create_workspace_for_current_user(
  workspace_name text,
  workspace_slug text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if length(trim(workspace_name)) < 2 then
    raise exception 'Workspace name is required';
  end if;

  insert into public.workspaces(name, slug, owner_user_id)
  values (trim(workspace_name), lower(trim(workspace_slug)), auth.uid())
  returning id into new_workspace_id;

  insert into public.workspace_members(workspace_id, user_id, role)
  values (new_workspace_id, auth.uid(), 'owner');

  return new_workspace_id;
end;
$$;

revoke all on function public.create_workspace_for_current_user(text,text) from public;
grant execute on function public.create_workspace_for_current_user(text,text) to authenticated;