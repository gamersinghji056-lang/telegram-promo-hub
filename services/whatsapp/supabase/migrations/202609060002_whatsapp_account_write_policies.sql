drop policy if exists "whatsapp owner insert" on public.whatsapp_accounts;
create policy "whatsapp owner insert"
on public.whatsapp_accounts
for insert
with check (
  exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = whatsapp_accounts.workspace_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
);

drop policy if exists "whatsapp owner update" on public.whatsapp_accounts;
create policy "whatsapp owner update"
on public.whatsapp_accounts
for update
using (
  exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = whatsapp_accounts.workspace_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
)
with check (
  exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = whatsapp_accounts.workspace_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
);

drop policy if exists "whatsapp owner delete" on public.whatsapp_accounts;
create policy "whatsapp owner delete"
on public.whatsapp_accounts
for delete
using (
  exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = whatsapp_accounts.workspace_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
);