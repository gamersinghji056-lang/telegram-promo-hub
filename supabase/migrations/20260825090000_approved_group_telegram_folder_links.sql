-- Store real Telegram exported chatlist links created from a tenant's approved groups.

CREATE TABLE IF NOT EXISTS public.telegram_folder_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.telegram_connections(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  slug text NOT NULL,
  filter_id integer NOT NULL,
  selected_group_ids uuid[] NOT NULL DEFAULT '{}',
  included_groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_telegram_folder_links_tenant_customer
  ON public.telegram_folder_links(tenant_id, customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telegram_folder_links_active
  ON public.telegram_folder_links(tenant_id, revoked_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.telegram_folder_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS telegram_folder_links_service_role_all
  ON public.telegram_folder_links;

CREATE POLICY telegram_folder_links_service_role_all
  ON public.telegram_folder_links
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.telegram_folder_links TO service_role;
