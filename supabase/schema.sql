-- SUPER MALHAS ATACADO. Dedicated schema; no changes to other applications.
CREATE SCHEMA IF NOT EXISTS supermalhas;
REVOKE ALL ON SCHEMA supermalhas FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA supermalhas TO service_role;

CREATE TABLE IF NOT EXISTS supermalhas.settings (
  key text PRIMARY KEY,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object')
);
CREATE TABLE IF NOT EXISTS supermalhas.products (
  id text PRIMARY KEY, slug text NOT NULL UNIQUE, title text NOT NULL,
  pieces integer NOT NULL CHECK (pieces > 0), price integer NOT NULL CHECK (price > 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active integer NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  featured integer NOT NULL DEFAULT 0 CHECK (featured IN (0,1)),
  description text NOT NULL, image text NOT NULL, specs jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS supermalhas.coupons (
  code text PRIMARY KEY, kind text NOT NULL CHECK (kind IN ('percent','fixed')),
  value integer NOT NULL CHECK (value > 0), minimum integer NOT NULL DEFAULT 0 CHECK (minimum >= 0),
  usage_limit integer NOT NULL DEFAULT 100 CHECK (usage_limit >= 1), used integer NOT NULL DEFAULT 0 CHECK (used >= 0),
  active integer NOT NULL DEFAULT 1 CHECK (active IN (0,1)), expires_at timestamptz
);
CREATE TABLE IF NOT EXISTS supermalhas.orders (
  id text PRIMARY KEY, number text NOT NULL UNIQUE, owner_key text NOT NULL, user_id text,
  request_key text NOT NULL, items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array'),
  customer jsonb NOT NULL, address jsonb NOT NULL, shipping jsonb NOT NULL,
  subtotal integer NOT NULL CHECK (subtotal >= 0), discount integer NOT NULL CHECK (discount >= 0),
  total integer NOT NULL CHECK (total >= 0), coupon_code text,
  payment_method text NOT NULL CHECK (payment_method IN ('pix','boleto','credit_card')),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('creating','pending','paid','failed','canceled','refunded','disputed','review')),
  fulfillment text NOT NULL DEFAULT 'new' CHECK (fulfillment IN ('new','processing','shipped','delivered','canceled')),
  payment_link text, provider_link_id text, provider_order_id text, provider_environment text,
  demo integer NOT NULL DEFAULT 0 CHECK (demo IN (0,1)), reserved integer NOT NULL DEFAULT 0 CHECK (reserved IN (0,1)),
  payment_config jsonb, charged_total integer, tracking_code text, carrier text, invoice_url text,
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
  CONSTRAINT orders_owner_request UNIQUE (owner_key,request_key),
  CONSTRAINT orders_total_valid CHECK (total = subtotal - discount + (shipping->>'amount')::integer)
);
CREATE TABLE IF NOT EXISTS supermalhas.order_events (
  id text PRIMARY KEY, order_id text NOT NULL REFERENCES supermalhas.orders(id),
  type text NOT NULL, note text NOT NULL, created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS supermalhas.profiles (
  user_id text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS supermalhas.contacts (
  id text PRIMARY KEY, name text NOT NULL, email text NOT NULL, message text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','resolved')), created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS supermalhas.newsletter (
  email text PRIMARY KEY, active integer NOT NULL DEFAULT 1 CHECK (active IN (0,1)), created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS supermalhas.rate_limits (
  id text PRIMARY KEY, count integer NOT NULL DEFAULT 1 CHECK (count >= 1), expires_at bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS orders_owner_created ON supermalhas.orders(owner_key,created_at DESC);
CREATE INDEX IF NOT EXISTS orders_created ON supermalhas.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_pending ON supermalhas.orders(provider_environment,created_at) WHERE reserved=1 AND demo=0;
CREATE INDEX IF NOT EXISTS order_events_order_created ON supermalhas.order_events(order_id,created_at);
CREATE INDEX IF NOT EXISTS contacts_created ON supermalhas.contacts(created_at DESC);
CREATE INDEX IF NOT EXISTS rate_limits_expiration ON supermalhas.rate_limits(expires_at);

ALTER TABLE supermalhas.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE supermalhas.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE supermalhas.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE supermalhas.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE supermalhas.order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE supermalhas.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE supermalhas.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE supermalhas.newsletter ENABLE ROW LEVEL SECURITY;
ALTER TABLE supermalhas.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA supermalhas FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA supermalhas TO service_role;

-- Images stay private in Storage; the storefront's image endpoint streams them.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('supermalhas-products','supermalhas-products',false,5242880,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;
