-- Pase · esquema base
-- Precios siempre en céntimos enteros. Fechas en timestamptz (UTC); la zona
-- horaria de presentación se guarda por restaurante (Europe/Madrid por defecto).

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE member_role AS ENUM ('owner', 'manager', 'waiter', 'kitchen');
CREATE TYPE service_session_status AS ENUM ('open', 'closed');
CREATE TYPE order_status AS ENUM ('open', 'closed', 'cancelled');
CREATE TYPE order_item_status AS ENUM (
  'queued', 'preparing', 'incident', 'ready', 'delivered', 'cancelled'
);
CREATE TYPE bill_request_status AS ENUM ('requested', 'attending', 'completed', 'cancelled');
CREATE TYPE printer_kind AS ENUM ('test', 'network', 'usb_agent');
CREATE TYPE print_job_status AS ENUM ('pending', 'processing', 'printed', 'failed');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled');

CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name text NOT NULL CHECK (length(full_name) BETWEEN 2 AND 120),
  is_active boolean NOT NULL DEFAULT true,
  is_superadmin boolean NOT NULL DEFAULT false,
  must_change_password boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  logo_url text,
  address text,
  phone text,
  timezone text NOT NULL DEFAULT 'Europe/Madrid',
  currency char(3) NOT NULL DEFAULT 'EUR',
  accent text NOT NULL DEFAULT 'olive' CHECK (accent IN ('olive', 'terracotta')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id)
);

CREATE TABLE restaurant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role member_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, user_id),
  UNIQUE (id, restaurant_id)
);
CREATE INDEX restaurant_members_user_idx ON restaurant_members(user_id);

CREATE TABLE kitchen_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  capacity integer NOT NULL DEFAULT 1 CHECK (capacity BETWEEN 1 AND 12),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, restaurant_id),
  UNIQUE (restaurant_id, name)
);

CREATE TABLE dining_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 40),
  zone text,
  seats integer NOT NULL DEFAULT 2 CHECK (seats BETWEEN 1 AND 40),
  qr_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, restaurant_id),
  UNIQUE (restaurant_id, label)
);

CREATE TABLE service_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id uuid NOT NULL,
  status service_session_status NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opened_by uuid REFERENCES app_users(id),
  closed_by uuid REFERENCES app_users(id),
  notes text,
  UNIQUE (id, restaurant_id),
  FOREIGN KEY (table_id, restaurant_id) REFERENCES dining_tables(id, restaurant_id)
);
CREATE UNIQUE INDEX service_sessions_one_open_per_table
  ON service_sessions(table_id) WHERE status = 'open';
CREATE INDEX service_sessions_restaurant_idx
  ON service_sessions(restaurant_id, status, opened_at DESC);

CREATE TABLE menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, restaurant_id),
  UNIQUE (restaurant_id, name)
);

CREATE TABLE menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id uuid NOT NULL,
  station_id uuid NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  description text,
  ingredients text,
  allergens text[] NOT NULL DEFAULT '{}',
  price_cents integer NOT NULL CHECK (price_cents >= 0 AND price_cents <= 1000000),
  image_url text,
  prep_minutes integer NOT NULL DEFAULT 10 CHECK (prep_minutes BETWEEN 1 AND 180),
  is_available boolean NOT NULL DEFAULT true,
  is_published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, restaurant_id),
  FOREIGN KEY (category_id, restaurant_id) REFERENCES menu_categories(id, restaurant_id),
  FOREIGN KEY (station_id, restaurant_id) REFERENCES kitchen_stations(id, restaurant_id)
);
CREATE INDEX menu_items_restaurant_idx
  ON menu_items(restaurant_id, category_id, sort_order);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id uuid NOT NULL,
  service_session_id uuid NOT NULL,
  order_number integer NOT NULL CHECK (order_number > 0),
  status order_status NOT NULL DEFAULT 'open',
  notes text,
  tracking_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  tracking_expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  idempotency_key text NOT NULL,
  created_by uuid REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  UNIQUE (id, restaurant_id),
  UNIQUE (restaurant_id, order_number),
  UNIQUE (restaurant_id, idempotency_key),
  FOREIGN KEY (table_id, restaurant_id) REFERENCES dining_tables(id, restaurant_id),
  FOREIGN KEY (service_session_id, restaurant_id) REFERENCES service_sessions(id, restaurant_id)
);
CREATE INDEX orders_active_idx
  ON orders(restaurant_id, status, created_at DESC);
CREATE INDEX orders_session_idx ON orders(service_session_id);

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL,
  menu_item_id uuid NOT NULL,
  station_id uuid NOT NULL,
  name_snapshot text NOT NULL,
  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
  prep_minutes_snapshot integer NOT NULL CHECK (prep_minutes_snapshot BETWEEN 1 AND 180),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  notes text,
  status order_item_status NOT NULL DEFAULT 'queued',
  queued_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  incident_note text,
  cancel_reason text,
  idempotency_key text,
  created_by uuid REFERENCES app_users(id),
  UNIQUE (id, restaurant_id),
  FOREIGN KEY (order_id, restaurant_id) REFERENCES orders(id, restaurant_id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id, restaurant_id) REFERENCES menu_items(id, restaurant_id),
  FOREIGN KEY (station_id, restaurant_id) REFERENCES kitchen_stations(id, restaurant_id)
);
CREATE UNIQUE INDEX order_items_idempotency_idx
  ON order_items(restaurant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX order_items_order_idx ON order_items(order_id, status);
CREATE INDEX order_items_station_queue_idx
  ON order_items(restaurant_id, station_id, status, queued_at);
CREATE INDEX order_items_tracking_idx ON order_items(order_id, queued_at);

CREATE TABLE kitchen_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL,
  from_status order_item_status,
  to_status order_item_status NOT NULL,
  actor_id uuid REFERENCES app_users(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (order_item_id, restaurant_id) REFERENCES order_items(id, restaurant_id) ON DELETE CASCADE
);
CREATE INDEX kitchen_events_item_idx ON kitchen_events(order_item_id, created_at DESC);
CREATE INDEX kitchen_events_restaurant_idx ON kitchen_events(restaurant_id, created_at DESC);

CREATE TABLE bill_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id uuid NOT NULL,
  service_session_id uuid NOT NULL,
  status bill_request_status NOT NULL DEFAULT 'requested',
  requested_at timestamptz NOT NULL DEFAULT now(),
  attended_at timestamptz,
  attended_by uuid REFERENCES app_users(id),
  completed_at timestamptz,
  cancelled_at timestamptz,
  note text,
  idempotency_key text,
  UNIQUE (restaurant_id, idempotency_key),
  FOREIGN KEY (table_id, restaurant_id) REFERENCES dining_tables(id, restaurant_id),
  FOREIGN KEY (service_session_id, restaurant_id) REFERENCES service_sessions(id, restaurant_id)
);
CREATE UNIQUE INDEX bill_requests_one_active_per_session
  ON bill_requests(service_session_id) WHERE status IN ('requested', 'attending');
CREATE INDEX bill_requests_active_idx
  ON bill_requests(restaurant_id, status, requested_at);

CREATE TABLE printers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  kind printer_kind NOT NULL DEFAULT 'test',
  target text,
  paper_width integer NOT NULL DEFAULT 80 CHECK (paper_width IN (58, 80)),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, restaurant_id),
  UNIQUE (restaurant_id, name)
);

CREATE TABLE printer_stations (
  printer_id uuid NOT NULL,
  station_id uuid NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  PRIMARY KEY (printer_id, station_id),
  FOREIGN KEY (printer_id, restaurant_id) REFERENCES printers(id, restaurant_id) ON DELETE CASCADE,
  FOREIGN KEY (station_id, restaurant_id) REFERENCES kitchen_stations(id, restaurant_id) ON DELETE CASCADE
);

CREATE TABLE print_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  printer_id uuid NOT NULL,
  order_id uuid,
  order_item_ids uuid[] NOT NULL DEFAULT '{}',
  payload jsonb NOT NULL,
  status print_job_status NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  printed_at timestamptz,
  reprint_of uuid REFERENCES print_jobs(id),
  idempotency_key text NOT NULL,
  created_by uuid REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, idempotency_key),
  FOREIGN KEY (printer_id, restaurant_id) REFERENCES printers(id, restaurant_id),
  FOREIGN KEY (order_id, restaurant_id) REFERENCES orders(id, restaurant_id)
);
CREATE INDEX print_jobs_queue_idx ON print_jobs(status, next_attempt_at);
CREATE INDEX print_jobs_restaurant_idx ON print_jobs(restaurant_id, created_at DESC);

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial', 'basic', 'pro')),
  status subscription_status NOT NULL DEFAULT 'trialing',
  seats integer NOT NULL DEFAULT 5 CHECK (seats BETWEEN 1 AND 500),
  current_period_end timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES app_users(id),
  actor_label text NOT NULL DEFAULT 'sistema',
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_restaurant_idx ON audit_logs(restaurant_id, created_at DESC);

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  user_agent text,
  ip inet,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX auth_sessions_user_idx ON auth_sessions(user_id, expires_at DESC);

CREATE TABLE rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 1
);

CREATE OR REPLACE FUNCTION app_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER menu_items_touch
BEFORE UPDATE ON menu_items
FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();

CREATE TRIGGER subscriptions_touch
BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();

-- Transiciones de estado permitidas, aplicadas también en la base de datos.
CREATE OR REPLACE FUNCTION app_enforce_item_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'queued'    AND NEW.status IN ('preparing', 'cancelled')) OR
    (OLD.status = 'preparing' AND NEW.status IN ('ready', 'incident', 'cancelled')) OR
    (OLD.status = 'incident'  AND NEW.status IN ('preparing', 'ready', 'cancelled')) OR
    (OLD.status = 'ready'     AND NEW.status IN ('delivered', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'transición de estado no permitida: % -> %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status = 'preparing' THEN
    NEW.started_at := COALESCE(NEW.started_at, now());
  ELSIF NEW.status = 'ready' THEN
    NEW.ready_at := COALESCE(NEW.ready_at, now());
  ELSIF NEW.status = 'delivered' THEN
    NEW.delivered_at := COALESCE(NEW.delivered_at, now());
  ELSIF NEW.status = 'cancelled' THEN
    NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER order_items_transition
BEFORE UPDATE OF status ON order_items
FOR EACH ROW EXECUTE FUNCTION app_enforce_item_transition();
