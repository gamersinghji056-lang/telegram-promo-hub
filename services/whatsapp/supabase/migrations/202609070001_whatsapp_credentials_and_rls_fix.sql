create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = target_workspace_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = target_workspace_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_admin(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;

drop policy if exists "workspace member read" on public.workspaces;
create policy "workspace member read"
on public.workspaces
for select
using (public.is_workspace_member(id));

drop policy if exists "workspace members read" on public.workspace_members;
create policy "workspace members read"
on public.workspace_members
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "whatsapp account member read" on public.whatsapp_accounts;
create policy "whatsapp account member read"
on public.whatsapp_accounts
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "whatsapp owner insert" on public.whatsapp_accounts;
create policy "whatsapp owner insert"
on public.whatsapp_accounts
for insert
with check (public.is_workspace_admin(workspace_id));

drop policy if exists "whatsapp owner update" on public.whatsapp_accounts;
create policy "whatsapp owner update"
on public.whatsapp_accounts
for update
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

drop policy if exists "whatsapp owner delete" on public.whatsapp_accounts;
create policy "whatsapp owner delete"
on public.whatsapp_accounts
for delete
using (public.is_workspace_admin(workspace_id));

create table if not exists public.whatsapp_credentials (
  account_id uuid primary key references public.whatsapp_accounts(id) on delete cascade,
  access_token_encrypted text not null,
  token_type text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_credentials enable row level security;

revoke all on public.whatsapp_credentials from anon, authenticated;