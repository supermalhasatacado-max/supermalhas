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

-- Closed operation catalogue. The caller sends identifiers and bound values,
-- never SQL. Only the server role can execute this function.
CREATE OR REPLACE FUNCTION public.sm_database_v1(operations jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path = supermalhas, pg_catalog
SET lock_timeout = '5s'
AS $function$
DECLARE
  op jsonb; params jsonb; template text; rendered text; parts text[];
  expected integer; mutates boolean; has_writes boolean := false;
  rows jsonb; output jsonb := '[]'::jsonb; position integer;
BEGIN
  IF jsonb_typeof(operations) IS DISTINCT FROM 'array' OR jsonb_array_length(operations)>100 OR jsonb_array_length(operations)<1 THEN
    RAISE EXCEPTION 'Invalid operation batch' USING ERRCODE='22023';
  END IF;
  -- Validate the entire batch before acquiring a lock or making any change.
  FOR op IN SELECT value FROM jsonb_array_elements(operations) LOOP
    CASE op->>'id'
    WHEN 'q_ae7702a206863b9d' THEN template := $query$DELETE FROM rate_limits WHERE expires_at<?$query$; expected := 1; mutates := true;
    WHEN 'q_bc276c4e9c3a4808' THEN template := $query$INSERT INTO contacts (id,name,email,message,status,created_at) VALUES (?,?,?,?,?,?)$query$; expected := 6; mutates := true;
    WHEN 'q_e7170d38cdc29b6b' THEN template := $query$INSERT INTO coupons (code,kind,value,minimum,usage_limit,used,active,expires_at) VALUES (?,?,?,?,?,0,?,?) ON CONFLICT(code) DO UPDATE SET kind=excluded.kind,value=excluded.value,minimum=excluded.minimum,usage_limit=excluded.usage_limit,active=excluded.active,expires_at=excluded.expires_at$query$; expected := 7; mutates := true;
    WHEN 'q_f0778d1d3c3b81e3' THEN template := $query$INSERT INTO newsletter (email,active,created_at) VALUES (?,1,?) ON CONFLICT(email) DO UPDATE SET active=1$query$; expected := 2; mutates := true;
    WHEN 'q_1cf5a282633acd7a' THEN template := $query$INSERT INTO products (id,slug,title,pieces,price,stock,active,featured,description,image,specs,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,pieces=excluded.pieces,price=excluded.price,stock=excluded.stock,active=excluded.active,featured=excluded.featured,description=excluded.description,image=excluded.image,specs=excluded.specs,updated_at=excluded.updated_at$query$; expected := 12; mutates := true;
    WHEN 'q_d7458ce3acc0433a' THEN template := $query$INSERT INTO profiles (user_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at$query$; expected := 3; mutates := true;
    WHEN 'q_077273ee59f4630d' THEN template := $query$INSERT INTO rate_limits (id,count,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=rate_limits.count+1 RETURNING count$query$; expected := 2; mutates := true;
    WHEN 'q_6d8e2018b9c4acc4' THEN template := $query$INSERT INTO order_events (id,order_id,type,note,created_at) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING$query$; expected := 5; mutates := true;
    WHEN 'q_3f9baafdaa572fa9' THEN template := $query$INSERT INTO products (id,slug,title,pieces,price,stock,active,featured,description,image,specs,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING$query$; expected := 12; mutates := true;
    WHEN 'q_dcd07ccaf99d803f' THEN template := $query$INSERT INTO rate_limits (id,count,expires_at) VALUES (?,1,?) ON CONFLICT DO NOTHING$query$; expected := 2; mutates := true;
    WHEN 'q_8b112bdec500696d' THEN template := $query$INSERT INTO settings (key,data) VALUES ('store',?) ON CONFLICT DO NOTHING$query$; expected := 1; mutates := true;
    WHEN 'q_0433dbe93ba2b47b' THEN template := $query$SELECT * FROM contacts ORDER BY created_at DESC LIMIT 200$query$; expected := 0; mutates := false;
    WHEN 'q_be1e5e46916359f2' THEN template := $query$SELECT * FROM coupons ORDER BY code$query$; expected := 0; mutates := false;
    WHEN 'q_31cfdacdfbfb9908' THEN template := $query$SELECT * FROM coupons WHERE code=?$query$; expected := 1; mutates := false;
    WHEN 'q_79c1913b1387c21a' THEN template := $query$SELECT * FROM order_events WHERE order_id=? ORDER BY created_at ASC$query$; expected := 1; mutates := false;
    WHEN 'q_5339d2cb4479a894' THEN template := $query$SELECT * FROM orders ORDER BY created_at DESC LIMIT 500$query$; expected := 0; mutates := false;
    WHEN 'q_a66263e7315c82e9' THEN template := $query$SELECT * FROM orders WHERE id=?$query$; expected := 1; mutates := false;
    WHEN 'q_7de3544244946f56' THEN template := $query$SELECT * FROM orders WHERE id=? AND owner_key=?$query$; expected := 2; mutates := false;
    WHEN 'q_0e27899798287934' THEN template := $query$SELECT * FROM orders WHERE number=? AND demo=0$query$; expected := 1; mutates := false;
    WHEN 'q_7e7f4c7b2afb78fa' THEN template := $query$SELECT * FROM orders WHERE owner_key=? ORDER BY created_at DESC LIMIT 100$query$; expected := 1; mutates := false;
    WHEN 'q_54acb68545c7d231' THEN template := $query$SELECT * FROM products ORDER BY pieces ASC$query$; expected := 0; mutates := false;
    WHEN 'q_5786d44c47bd474b' THEN template := $query$SELECT * FROM products WHERE active=1 ORDER BY pieces ASC$query$; expected := 0; mutates := false;
    WHEN 'q_5ec83e15d8b77b42' THEN template := $query$SELECT data FROM profiles WHERE user_id=?$query$; expected := 1; mutates := false;
    WHEN 'q_f34daea19beaeed4' THEN template := $query$SELECT data FROM settings WHERE key='store'$query$; expected := 0; mutates := false;
    WHEN 'q_63d62c5d7757cbf5' THEN template := $query$SELECT email,created_at,active FROM newsletter ORDER BY created_at DESC LIMIT 500$query$; expected := 0; mutates := false;
    WHEN 'q_655a8563a5e80740' THEN template := $query$SELECT id FROM orders WHERE demo=0 AND reserved=1 AND payment_status IN ('creating','pending') AND provider_environment=? AND (payment_config->>'expiresAt')<? ORDER BY created_at LIMIT 3$query$; expected := 2; mutates := false;
    WHEN 'q_6deb771166e5fd2d' THEN template := $query$SELECT id FROM orders WHERE owner_key=? AND request_key=?$query$; expected := 2; mutates := false;
    WHEN 'q_216dfff62406a04d' THEN template := $query$SELECT key FROM settings WHERE key = 'store'$query$; expected := 0; mutates := false;
    WHEN 'q_70b035c3f6e391f6' THEN template := $query$UPDATE contacts SET status=? WHERE id=?$query$; expected := 2; mutates := true;
    WHEN 'q_ec0d8609005c8b3d' THEN template := $query$UPDATE coupons SET used=GREATEST(0,used-1) WHERE code=? AND EXISTS (SELECT 1 FROM orders WHERE id=? AND reserved=1 AND fulfillment IN ('new','processing') AND payment_status IN ('canceled','failed','refunded') AND payment_status!='refunded')$query$; expected := 2; mutates := true;
    WHEN 'q_b2f87e7574aae67b' THEN template := $query$UPDATE coupons SET used=used+1 WHERE code=? AND EXISTS (SELECT 1 FROM orders WHERE id=?)$query$; expected := 2; mutates := true;
    WHEN 'q_2ad6faf22dd8e11e' THEN template := $query$UPDATE orders SET fulfillment=?,tracking_code=?,carrier=?,invoice_url=?,updated_at=? WHERE id=?$query$; expected := 6; mutates := true;
    WHEN 'q_2129e92fb63e2652' THEN template := $query$UPDATE orders SET owner_key=?,user_id=? WHERE owner_key=? AND NOT EXISTS (SELECT 1 FROM orders AS existing WHERE existing.owner_key=? AND existing.request_key=orders.request_key)$query$; expected := 4; mutates := true;
    WHEN 'q_bd31b64f2d2eec30' THEN template := $query$UPDATE orders SET payment_link=?,provider_link_id=?,provider_environment=?,payment_status='pending',updated_at=? WHERE id=? AND payment_link IS NULL$query$; expected := 5; mutates := true;
    WHEN 'q_620798dba9ba0812' THEN template := $query$UPDATE orders SET payment_status='canceled',fulfillment='canceled',updated_at=? WHERE id=? AND demo=1$query$; expected := 2; mutates := true;
    WHEN 'q_2e24f79682f53436' THEN template := $query$UPDATE orders SET payment_status='canceled',updated_at=? WHERE id=? AND payment_status IN ('creating','pending')$query$; expected := 2; mutates := true;
    WHEN 'q_41da9dc0a3476cae' THEN template := $query$UPDATE orders SET payment_status='canceled',updated_at=? WHERE id=? AND payment_status IN ('creating','pending','failed','canceled')$query$; expected := 2; mutates := true;
    WHEN 'q_b98cc975531b6802' THEN template := $query$UPDATE orders SET payment_status='review',updated_at=? WHERE id=?$query$; expected := 2; mutates := true;
    WHEN 'q_2933b894351c7aae' THEN template := $query$UPDATE orders SET payment_status=?,updated_at=? WHERE id=? AND demo=1$query$; expected := 3; mutates := true;
    WHEN 'q_c1562d69a8fbe924' THEN template := $query$UPDATE orders SET provider_order_id=?,payment_status=?,charged_total=?,updated_at=? WHERE id=? AND payment_status=? AND (provider_order_id IS NULL OR provider_order_id=?)$query$; expected := 7; mutates := true;
    WHEN 'q_ed8f2dd786f1bc0c' THEN template := $query$UPDATE orders SET reserved=0,fulfillment='canceled',updated_at=? WHERE id=? AND reserved=1 AND fulfillment IN ('new','processing') AND payment_status IN ('canceled','failed','refunded')$query$; expected := 2; mutates := true;
    WHEN 'q_941bece2e34f2d32' THEN template := $query$UPDATE products SET stock=stock+? WHERE id=? AND EXISTS (SELECT 1 FROM orders WHERE id=? AND reserved=1 AND fulfillment IN ('new','processing') AND payment_status IN ('canceled','failed','refunded'))$query$; expected := 3; mutates := true;
    WHEN 'q_706fe89910f8aac5' THEN template := $query$UPDATE products SET stock=stock-?,updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM orders WHERE id=?)$query$; expected := 4; mutates := true;
    WHEN 'q_047e452dbb022695' THEN template := $query$UPDATE settings SET data=? WHERE key='store'$query$; expected := 1; mutates := true;
    WHEN 'checkout_insert' THEN template := $query$INSERT INTO orders (id,number,owner_key,user_id,request_key,items,customer,address,shipping,subtotal,discount,total,coupon_code,payment_method,payment_status,fulfillment,demo,reserved,provider_environment,created_at,updated_at,payment_config) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'new',?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(?::jsonb) AS check_item LEFT JOIN products p ON p.id=check_item->>'productId' WHERE p.id IS NULL OR p.active!=1 OR p.price!=(check_item->>'price')::integer OR p.pieces!=(check_item->>'pieces')::integer OR (check_item->>'qty' IS NOT NULL AND p.stock<(check_item->>'qty')::integer)) AND (SELECT coupon IS NULL OR EXISTS (SELECT 1 FROM coupons c WHERE c.code=coupon->>'code' AND c.kind=coupon->>'kind' AND c.value=(coupon->>'value')::integer AND c.minimum=(coupon->>'minimum')::integer AND c.active=1 AND c.used<c.usage_limit AND (c.expires_at IS NULL OR c.expires_at>(coupon->>'stamp')::timestamptz)) FROM (SELECT NULLIF(?::jsonb,'null'::jsonb) AS coupon) snapshot)$query$; expected := 23; mutates := true;
    ELSE RAISE EXCEPTION 'Unknown database operation' USING ERRCODE='22023';
    END CASE;
    params := op->'params';
    IF jsonb_typeof(params) IS DISTINCT FROM 'array' OR jsonb_array_length(params)!=expected THEN
      RAISE EXCEPTION 'Invalid bound parameters' USING ERRCODE='22023';
    END IF;
    has_writes := has_writes OR mutates;
  END LOOP;
  -- PostgreSQL serializes all store mutations, including admin stock edits.
  -- One RPC is one transaction: checkout, coupon use and inventory move together.
  IF has_writes THEN PERFORM pg_advisory_xact_lock(1936747372,1); END IF;
  FOR op IN SELECT value FROM jsonb_array_elements(operations) LOOP
    CASE op->>'id'
    WHEN 'q_ae7702a206863b9d' THEN template := $query$DELETE FROM rate_limits WHERE expires_at<?$query$; expected := 1; mutates := true;
    WHEN 'q_bc276c4e9c3a4808' THEN template := $query$INSERT INTO contacts (id,name,email,message,status,created_at) VALUES (?,?,?,?,?,?)$query$; expected := 6; mutates := true;
    WHEN 'q_e7170d38cdc29b6b' THEN template := $query$INSERT INTO coupons (code,kind,value,minimum,usage_limit,used,active,expires_at) VALUES (?,?,?,?,?,0,?,?) ON CONFLICT(code) DO UPDATE SET kind=excluded.kind,value=excluded.value,minimum=excluded.minimum,usage_limit=excluded.usage_limit,active=excluded.active,expires_at=excluded.expires_at$query$; expected := 7; mutates := true;
    WHEN 'q_f0778d1d3c3b81e3' THEN template := $query$INSERT INTO newsletter (email,active,created_at) VALUES (?,1,?) ON CONFLICT(email) DO UPDATE SET active=1$query$; expected := 2; mutates := true;
    WHEN 'q_1cf5a282633acd7a' THEN template := $query$INSERT INTO products (id,slug,title,pieces,price,stock,active,featured,description,image,specs,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,pieces=excluded.pieces,price=excluded.price,stock=excluded.stock,active=excluded.active,featured=excluded.featured,description=excluded.description,image=excluded.image,specs=excluded.specs,updated_at=excluded.updated_at$query$; expected := 12; mutates := true;
    WHEN 'q_d7458ce3acc0433a' THEN template := $query$INSERT INTO profiles (user_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at$query$; expected := 3; mutates := true;
    WHEN 'q_077273ee59f4630d' THEN template := $query$INSERT INTO rate_limits (id,count,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=rate_limits.count+1 RETURNING count$query$; expected := 2; mutates := true;
    WHEN 'q_6d8e2018b9c4acc4' THEN template := $query$INSERT INTO order_events (id,order_id,type,note,created_at) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING$query$; expected := 5; mutates := true;
    WHEN 'q_3f9baafdaa572fa9' THEN template := $query$INSERT INTO products (id,slug,title,pieces,price,stock,active,featured,description,image,specs,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING$query$; expected := 12; mutates := true;
    WHEN 'q_dcd07ccaf99d803f' THEN template := $query$INSERT INTO rate_limits (id,count,expires_at) VALUES (?,1,?) ON CONFLICT DO NOTHING$query$; expected := 2; mutates := true;
    WHEN 'q_8b112bdec500696d' THEN template := $query$INSERT INTO settings (key,data) VALUES ('store',?) ON CONFLICT DO NOTHING$query$; expected := 1; mutates := true;
    WHEN 'q_0433dbe93ba2b47b' THEN template := $query$SELECT * FROM contacts ORDER BY created_at DESC LIMIT 200$query$; expected := 0; mutates := false;
    WHEN 'q_be1e5e46916359f2' THEN template := $query$SELECT * FROM coupons ORDER BY code$query$; expected := 0; mutates := false;
    WHEN 'q_31cfdacdfbfb9908' THEN template := $query$SELECT * FROM coupons WHERE code=?$query$; expected := 1; mutates := false;
    WHEN 'q_79c1913b1387c21a' THEN template := $query$SELECT * FROM order_events WHERE order_id=? ORDER BY created_at ASC$query$; expected := 1; mutates := false;
    WHEN 'q_5339d2cb4479a894' THEN template := $query$SELECT * FROM orders ORDER BY created_at DESC LIMIT 500$query$; expected := 0; mutates := false;
    WHEN 'q_a66263e7315c82e9' THEN template := $query$SELECT * FROM orders WHERE id=?$query$; expected := 1; mutates := false;
    WHEN 'q_7de3544244946f56' THEN template := $query$SELECT * FROM orders WHERE id=? AND owner_key=?$query$; expected := 2; mutates := false;
    WHEN 'q_0e27899798287934' THEN template := $query$SELECT * FROM orders WHERE number=? AND demo=0$query$; expected := 1; mutates := false;
    WHEN 'q_7e7f4c7b2afb78fa' THEN template := $query$SELECT * FROM orders WHERE owner_key=? ORDER BY created_at DESC LIMIT 100$query$; expected := 1; mutates := false;
    WHEN 'q_54acb68545c7d231' THEN template := $query$SELECT * FROM products ORDER BY pieces ASC$query$; expected := 0; mutates := false;
    WHEN 'q_5786d44c47bd474b' THEN template := $query$SELECT * FROM products WHERE active=1 ORDER BY pieces ASC$query$; expected := 0; mutates := false;
    WHEN 'q_5ec83e15d8b77b42' THEN template := $query$SELECT data FROM profiles WHERE user_id=?$query$; expected := 1; mutates := false;
    WHEN 'q_f34daea19beaeed4' THEN template := $query$SELECT data FROM settings WHERE key='store'$query$; expected := 0; mutates := false;
    WHEN 'q_63d62c5d7757cbf5' THEN template := $query$SELECT email,created_at,active FROM newsletter ORDER BY created_at DESC LIMIT 500$query$; expected := 0; mutates := false;
    WHEN 'q_655a8563a5e80740' THEN template := $query$SELECT id FROM orders WHERE demo=0 AND reserved=1 AND payment_status IN ('creating','pending') AND provider_environment=? AND (payment_config->>'expiresAt')<? ORDER BY created_at LIMIT 3$query$; expected := 2; mutates := false;
    WHEN 'q_6deb771166e5fd2d' THEN template := $query$SELECT id FROM orders WHERE owner_key=? AND request_key=?$query$; expected := 2; mutates := false;
    WHEN 'q_216dfff62406a04d' THEN template := $query$SELECT key FROM settings WHERE key = 'store'$query$; expected := 0; mutates := false;
    WHEN 'q_70b035c3f6e391f6' THEN template := $query$UPDATE contacts SET status=? WHERE id=?$query$; expected := 2; mutates := true;
    WHEN 'q_ec0d8609005c8b3d' THEN template := $query$UPDATE coupons SET used=GREATEST(0,used-1) WHERE code=? AND EXISTS (SELECT 1 FROM orders WHERE id=? AND reserved=1 AND fulfillment IN ('new','processing') AND payment_status IN ('canceled','failed','refunded') AND payment_status!='refunded')$query$; expected := 2; mutates := true;
    WHEN 'q_b2f87e7574aae67b' THEN template := $query$UPDATE coupons SET used=used+1 WHERE code=? AND EXISTS (SELECT 1 FROM orders WHERE id=?)$query$; expected := 2; mutates := true;
    WHEN 'q_2ad6faf22dd8e11e' THEN template := $query$UPDATE orders SET fulfillment=?,tracking_code=?,carrier=?,invoice_url=?,updated_at=? WHERE id=?$query$; expected := 6; mutates := true;
    WHEN 'q_2129e92fb63e2652' THEN template := $query$UPDATE orders SET owner_key=?,user_id=? WHERE owner_key=? AND NOT EXISTS (SELECT 1 FROM orders AS existing WHERE existing.owner_key=? AND existing.request_key=orders.request_key)$query$; expected := 4; mutates := true;
    WHEN 'q_bd31b64f2d2eec30' THEN template := $query$UPDATE orders SET payment_link=?,provider_link_id=?,provider_environment=?,payment_status='pending',updated_at=? WHERE id=? AND payment_link IS NULL$query$; expected := 5; mutates := true;
    WHEN 'q_620798dba9ba0812' THEN template := $query$UPDATE orders SET payment_status='canceled',fulfillment='canceled',updated_at=? WHERE id=? AND demo=1$query$; expected := 2; mutates := true;
    WHEN 'q_2e24f79682f53436' THEN template := $query$UPDATE orders SET payment_status='canceled',updated_at=? WHERE id=? AND payment_status IN ('creating','pending')$query$; expected := 2; mutates := true;
    WHEN 'q_41da9dc0a3476cae' THEN template := $query$UPDATE orders SET payment_status='canceled',updated_at=? WHERE id=? AND payment_status IN ('creating','pending','failed','canceled')$query$; expected := 2; mutates := true;
    WHEN 'q_b98cc975531b6802' THEN template := $query$UPDATE orders SET payment_status='review',updated_at=? WHERE id=?$query$; expected := 2; mutates := true;
    WHEN 'q_2933b894351c7aae' THEN template := $query$UPDATE orders SET payment_status=?,updated_at=? WHERE id=? AND demo=1$query$; expected := 3; mutates := true;
    WHEN 'q_c1562d69a8fbe924' THEN template := $query$UPDATE orders SET provider_order_id=?,payment_status=?,charged_total=?,updated_at=? WHERE id=? AND payment_status=? AND (provider_order_id IS NULL OR provider_order_id=?)$query$; expected := 7; mutates := true;
    WHEN 'q_ed8f2dd786f1bc0c' THEN template := $query$UPDATE orders SET reserved=0,fulfillment='canceled',updated_at=? WHERE id=? AND reserved=1 AND fulfillment IN ('new','processing') AND payment_status IN ('canceled','failed','refunded')$query$; expected := 2; mutates := true;
    WHEN 'q_941bece2e34f2d32' THEN template := $query$UPDATE products SET stock=stock+? WHERE id=? AND EXISTS (SELECT 1 FROM orders WHERE id=? AND reserved=1 AND fulfillment IN ('new','processing') AND payment_status IN ('canceled','failed','refunded'))$query$; expected := 3; mutates := true;
    WHEN 'q_706fe89910f8aac5' THEN template := $query$UPDATE products SET stock=stock-?,updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM orders WHERE id=?)$query$; expected := 4; mutates := true;
    WHEN 'q_047e452dbb022695' THEN template := $query$UPDATE settings SET data=? WHERE key='store'$query$; expected := 1; mutates := true;
    WHEN 'checkout_insert' THEN template := $query$INSERT INTO orders (id,number,owner_key,user_id,request_key,items,customer,address,shipping,subtotal,discount,total,coupon_code,payment_method,payment_status,fulfillment,demo,reserved,provider_environment,created_at,updated_at,payment_config) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'new',?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(?::jsonb) AS check_item LEFT JOIN products p ON p.id=check_item->>'productId' WHERE p.id IS NULL OR p.active!=1 OR p.price!=(check_item->>'price')::integer OR p.pieces!=(check_item->>'pieces')::integer OR (check_item->>'qty' IS NOT NULL AND p.stock<(check_item->>'qty')::integer)) AND (SELECT coupon IS NULL OR EXISTS (SELECT 1 FROM coupons c WHERE c.code=coupon->>'code' AND c.kind=coupon->>'kind' AND c.value=(coupon->>'value')::integer AND c.minimum=(coupon->>'minimum')::integer AND c.active=1 AND c.used<c.usage_limit AND (c.expires_at IS NULL OR c.expires_at>(coupon->>'stamp')::timestamptz)) FROM (SELECT NULLIF(?::jsonb,'null'::jsonb) AS coupon) snapshot)$query$; expected := 23; mutates := true;
    ELSE RAISE EXCEPTION 'Unknown database operation';
    END CASE;
    params := op->'params'; parts := string_to_array(template,'?'); rendered := parts[1];
    FOR position IN 1..expected LOOP
      rendered := rendered || quote_nullable(params->>(position-1)) || parts[position+1];
    END LOOP;
    IF mutates THEN
      IF template NOT ILIKE '% RETURNING %' THEN rendered := rendered || ' RETURNING 1 AS changed'; END IF;
      EXECUTE 'WITH changed AS (' || rendered || ') SELECT COALESCE(jsonb_agg(to_jsonb(changed)),''[]''::jsonb) FROM changed' INTO rows;
    ELSE
      EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(result)),''[]''::jsonb) FROM (' || rendered || ') result' INTO rows;
    END IF;
    output := output || jsonb_build_array(jsonb_build_object('results',rows,'success',true,'meta',jsonb_build_object('changes',CASE WHEN mutates THEN jsonb_array_length(rows) ELSE 0 END)));
  END LOOP;
  RETURN output;
END;
$function$;
REVOKE ALL ON FUNCTION public.sm_database_v1(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sm_database_v1(jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
