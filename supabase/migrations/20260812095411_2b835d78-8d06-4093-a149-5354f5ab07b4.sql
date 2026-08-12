-- ROLES
CREATE TYPE public.app_role AS ENUM ('super_admin','customer','customer_user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- PLANS
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  price_usd numeric(12,2) NOT NULL DEFAULT 0,
  duration_days integer NOT NULL DEFAULT 30,
  max_connections integer NOT NULL DEFAULT 1,
  max_groups integer NOT NULL DEFAULT 10,
  max_campaigns integer NOT NULL DEFAULT 5,
  max_audience integer NOT NULL DEFAULT 500,
  monthly_message_limit integer NOT NULL DEFAULT 500,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- TENANTS
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  plan_id uuid REFERENCES public.plans(id),
  plan_expires_at timestamptz,
  messages_used integer NOT NULL DEFAULT 0,
  usage_period_start timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text,
  telegram_user_id bigint UNIQUE,
  telegram_username text,
  status text NOT NULL DEFAULT 'ACTIVE',
  email_verified boolean NOT NULL DEFAULT false,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customers_tenant ON public.customers(tenant_id);
CREATE INDEX idx_customers_tg ON public.customers(telegram_user_id);

CREATE TABLE public.tenant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'customer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, customer_id)
);

CREATE TABLE public.customer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_customer ON public.customer_sessions(customer_id);

CREATE TABLE public.bot_states (
  telegram_user_id bigint PRIMARY KEY,
  state text NOT NULL DEFAULT 'IDLE',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'ACTIVE',
  payment_status text NOT NULL DEFAULT 'NONE',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subs_tenant ON public.subscriptions(tenant_id);
CREATE INDEX idx_subs_status ON public.subscriptions(status);

-- TELEGRAM CONNECTIONS
CREATE TABLE public.telegram_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label text NOT NULL,
  account_name text,
  username text,
  telegram_id bigint,
  status text NOT NULL DEFAULT 'REQUIRES_ACTION',
  error_message text,
  last_active_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_conn_tenant ON public.telegram_connections(tenant_id);

CREATE TABLE public.keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, keyword)
);

CREATE TABLE public.discovered_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  username text,
  telegram_group_id bigint,
  member_count integer,
  matched_keywords text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'FOUND',
  connection_id uuid REFERENCES public.telegram_connections(id) ON DELETE SET NULL,
  join_error text,
  approved_at timestamptz,
  joined_at timestamptz,
  last_promoted_at timestamptz,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, username)
);
CREATE INDEX idx_groups_tenant ON public.discovered_groups(tenant_id);
CREATE INDEX idx_groups_status ON public.discovered_groups(status);

CREATE TABLE public.group_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.discovered_groups(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.telegram_connections(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'PENDING',
  error text,
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, connection_id)
);

-- AUDIENCE
CREATE TABLE public.audience_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  telegram_user_id bigint NOT NULL,
  display_name text,
  username text,
  source_group_id uuid REFERENCES public.discovered_groups(id) ON DELETE SET NULL,
  eligibility text NOT NULL DEFAULT 'ELIGIBLE',
  status text NOT NULL DEFAULT 'NEW',
  first_found_at timestamptz NOT NULL DEFAULT now(),
  last_contacted_at timestamptz,
  contact_count integer NOT NULL DEFAULT 0,
  last_campaign_id uuid,
  UNIQUE (tenant_id, telegram_user_id)
);
CREATE INDEX idx_audience_tenant ON public.audience_contacts(tenant_id);
CREATE INDEX idx_audience_tg ON public.audience_contacts(telegram_user_id);

-- TEMPLATES
CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  body text NOT NULL DEFAULT '',
  media_type text,
  media_url text,
  buttons jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_templates_tenant ON public.message_templates(tenant_id);

-- CAMPAIGNS
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'GROUP',
  status text NOT NULL DEFAULT 'DRAFT',
  connection_id uuid REFERENCES public.telegram_connections(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  message jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  total_targets integer NOT NULL DEFAULT 0,
  completed_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaigns_tenant ON public.campaigns(tenant_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_campaigns_created ON public.campaigns(created_at);

CREATE TABLE public.campaign_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.discovered_groups(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING',
  error text,
  sent_at timestamptz,
  UNIQUE (campaign_id, group_id)
);

CREATE TABLE public.campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.audience_contacts(id) ON DELETE SET NULL,
  telegram_user_id bigint NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  error text,
  sent_at timestamptz,
  UNIQUE (campaign_id, telegram_user_id)
);

CREATE TABLE public.campaign_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  target_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'QUEUED',
  attempts integer NOT NULL DEFAULT 0,
  locked_at timestamptz,
  run_after timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, job_type, target_id)
);
CREATE INDEX idx_jobs_status ON public.campaign_jobs(status, run_after);

CREATE TABLE public.campaign_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'INFO',
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_clogs_campaign ON public.campaign_logs(campaign_id);

-- BILLING
CREATE TABLE public.billing_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USDT',
  network text NOT NULL DEFAULT 'TRC20',
  wallet_address text,
  status text NOT NULL DEFAULT 'PENDING',
  tx_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE INDEX idx_billing_tenant ON public.billing_transactions(tenant_id);

-- NOTIFICATIONS / LOGS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  kind text NOT NULL DEFAULT 'INFO',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_tenant ON public.notifications(tenant_id, created_at DESC);

CREATE TABLE public.system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource text,
  status text NOT NULL DEFAULT 'OK',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_slogs_created ON public.system_logs(created_at DESC);
CREATE INDEX idx_slogs_tenant ON public.system_logs(tenant_id);

CREATE TABLE public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid,
  action text NOT NULL,
  resource text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_alogs_created ON public.admin_logs(created_at DESC);

-- SETTINGS
CREATE TABLE public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- GRANTS + RLS (server-only access; the app resolves the tenant from the session)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'plans','tenants','customers','tenant_members','customer_sessions','bot_states','subscriptions',
    'telegram_connections','keywords','discovered_groups','group_memberships','audience_contacts',
    'message_templates','campaigns','campaign_groups','campaign_recipients','campaign_jobs',
    'campaign_logs','billing_transactions','notifications','system_logs','admin_logs','system_settings'
  ]
  LOOP
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- SEED
INSERT INTO public.plans (code,name,price_usd,duration_days,max_connections,max_groups,max_campaigns,max_audience,monthly_message_limit,sort_order) VALUES
 ('FREE','Free',0,30,1,10,3,200,200,1),
 ('BASIC','Basic',19,30,2,50,10,2000,2000,2),
 ('PRO','Pro',49,30,5,200,50,10000,10000,3),
 ('PREMIUM','Premium',99,30,15,1000,200,50000,50000,4);

INSERT INTO public.system_settings (key,value) VALUES
 ('general', '{"system_name":"Telegram Promotion Platform","support_email":"","support_telegram":"","logo_url":"","maintenance_mode":false}'::jsonb),
 ('registration', '{"registration_enabled":true,"email_verification_enabled":false,"default_plan_code":"FREE"}'::jsonb),
 ('payments', '{"payment_enabled":false,"network":"TRC20","wallet_address":""}'::jsonb),
 ('telegram', '{"bot_username":"","mini_app_url":"","bot_token_configured":false}'::jsonb);