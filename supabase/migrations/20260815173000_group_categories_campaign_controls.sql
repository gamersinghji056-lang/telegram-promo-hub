-- Mini App group category and campaign control metadata.

CREATE TABLE IF NOT EXISTS public.group_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_group_categories_tenant
  ON public.group_categories(tenant_id);

CREATE TABLE IF NOT EXISTS public.group_category_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.group_categories(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.discovered_groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_group_category_members_tenant
  ON public.group_category_members(tenant_id);

CREATE INDEX IF NOT EXISTS idx_group_category_members_category
  ON public.group_category_members(category_id);

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS group_category_id uuid REFERENCES public.group_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS min_delay_seconds integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS max_delay_seconds integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS cycle_delay_minutes integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS cycles_completed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_campaigns_category
  ON public.campaigns(group_category_id);

CREATE INDEX IF NOT EXISTS idx_campaigns_deleted
  ON public.campaigns(tenant_id, deleted_at);
