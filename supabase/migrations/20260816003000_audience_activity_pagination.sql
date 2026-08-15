alter table public.audience_contacts
  add column if not exists presence_status text not null default 'UNKNOWN',
  add column if not exists last_seen_at timestamptz,
  add column if not exists recent_activity_at timestamptz,
  add column if not exists messages_observed integer not null default 0,
  add column if not exists active_source_group_ids uuid[] not null default '{}',
  add column if not exists last_activity_checked_at timestamptz;

create index if not exists idx_audience_contacts_tenant_eligibility
  on public.audience_contacts(tenant_id, eligibility, first_found_at desc);

create index if not exists idx_audience_contacts_tenant_presence
  on public.audience_contacts(tenant_id, presence_status);

create index if not exists idx_audience_contacts_tenant_activity
  on public.audience_contacts(tenant_id, recent_activity_at desc)
  where recent_activity_at is not null;

create index if not exists idx_audience_contacts_active_groups
  on public.audience_contacts using gin(active_source_group_ids);
