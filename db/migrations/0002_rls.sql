-- Pase · aislamiento multiempresa mediante RLS.
-- El rol de ejecución (pase_app) no es propietario ni superusuario y todas las
-- tablas llevan FORCE ROW LEVEL SECURITY. El contexto de usuario se fija por
-- transacción con set_config('app.user_id', ...), nunca con un restaurant_id
-- recibido del navegador.

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app.is_superadmin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_users u
    WHERE u.id = app.current_user_id() AND u.is_superadmin AND u.is_active
  );
$$;

CREATE OR REPLACE FUNCTION app.is_member(p_restaurant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM restaurant_members m
    JOIN app_users u ON u.id = m.user_id
    WHERE m.restaurant_id = p_restaurant_id
      AND m.user_id = app.current_user_id()
      AND u.is_active
  );
$$;

CREATE OR REPLACE FUNCTION app.has_role(p_restaurant_id uuid, p_roles member_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM restaurant_members m
    JOIN app_users u ON u.id = m.user_id
    WHERE m.restaurant_id = p_restaurant_id
      AND m.user_id = app.current_user_id()
      AND m.role = ANY (p_roles)
      AND u.is_active
  );
$$;

CREATE OR REPLACE FUNCTION app.shares_restaurant(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM restaurant_members mine
    JOIN restaurant_members theirs ON theirs.restaurant_id = mine.restaurant_id
    WHERE mine.user_id = app.current_user_id()
      AND theirs.user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION app.is_staff_of(p_restaurant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT app.is_member(p_restaurant_id) OR app.is_superadmin();
$$;

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users FORCE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants FORCE ROW LEVEL SECURITY;
ALTER TABLE restaurant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_members FORCE ROW LEVEL SECURITY;
ALTER TABLE kitchen_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_stations FORCE ROW LEVEL SECURITY;
ALTER TABLE dining_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_tables FORCE ROW LEVEL SECURITY;
ALTER TABLE service_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items FORCE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE kitchen_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_events FORCE ROW LEVEL SECURITY;
ALTER TABLE bill_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE printers FORCE ROW LEVEL SECURITY;
ALTER TABLE printer_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE printer_stations FORCE ROW LEVEL SECURITY;
ALTER TABLE print_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_agents FORCE ROW LEVEL SECURITY;
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-- Personal ---------------------------------------------------------------
CREATE POLICY app_users_select ON app_users FOR SELECT USING (
  id = app.current_user_id()
  OR app.shares_restaurant(id)
  OR app.is_superadmin()
);

CREATE POLICY restaurants_select ON restaurants FOR SELECT USING (
  app.is_member(id) OR app.is_superadmin()
);
CREATE POLICY restaurants_update ON restaurants FOR UPDATE USING (
  app.has_role(id, ARRAY['owner', 'manager']::member_role[]) OR app.is_superadmin()
) WITH CHECK (
  app.has_role(id, ARRAY['owner', 'manager']::member_role[]) OR app.is_superadmin()
);

CREATE POLICY members_select ON restaurant_members FOR SELECT USING (
  app.is_member(restaurant_id) OR app.is_superadmin()
);

-- Carta ------------------------------------------------------------------
CREATE POLICY stations_select ON kitchen_stations FOR SELECT USING (
  app.is_member(restaurant_id) OR app.is_superadmin()
);
CREATE POLICY stations_write ON kitchen_stations FOR ALL USING (
  app.has_role(restaurant_id, ARRAY['owner', 'manager']::member_role[]) OR app.is_superadmin()
) WITH CHECK (
  app.has_role(restaurant_id, ARRAY['owner', 'manager']::member_role[]) OR app.is_superadmin()
);

CREATE POLICY categories_select ON menu_categories FOR SELECT USING (
  app.is_member(restaurant_id) OR app.is_superadmin()
);
CREATE POLICY categories_write ON menu_categories FOR ALL USING (
  app.has_role(restaurant_id, ARRAY['owner', 'manager']::member_role[]) OR app.is_superadmin()
) WITH CHECK (
  app.has_role(restaurant_id, ARRAY['owner', 'manager']::member_role[]) OR app.is_superadmin()
);

CREATE POLICY menu_items_select ON menu_items FOR SELECT USING (
  app.is_member(restaurant_id) OR app.is_superadmin()
);
CREATE POLICY menu_items_write ON menu_items FOR ALL USING (
  app.has_role(restaurant_id, ARRAY['owner', 'manager']::member_role[]) OR app.is_superadmin()
) WITH CHECK (
  app.has_role(restaurant_id, ARRAY['owner', 'manager']::member_role[]) OR app.is_superadmin()
);

-- Mesas y sesiones -------------------------------------------------------
CREATE POLICY tables_select ON dining_tables FOR SELECT USING (
  app.is_member(restaurant_id) OR app.is_superadmin()
);
CREATE POLICY tables_write ON dining_tables FOR ALL USING (
  app.has_role(restaurant_id, ARRAY['owner', 'manager']::member_role[]) OR app.is_superadmin()
) WITH CHECK (
  app.has_role(restaurant_id, ARRAY['owner', 'manager']::member_role[]) OR app.is_superadmin()
);

CREATE POLICY sessions_select ON service_sessions FOR SELECT USING (
  app.is_member(restaurant_id) OR app.is_superadmin()
);
CREATE POLICY sessions_insert ON service_sessions FOR INSERT WITH CHECK (
  app.has_role(restaurant_id, ARRAY['owner', 'manager', 'waiter']::member_role[]) OR app.is_superadmin()
);
CREATE POLICY sessions_update ON service_sessions FOR UPDATE USING (
  app.has_role(restaurant_id, ARRAY['owner', 'manager', 'waiter']::member_role[]) OR app.is_superadmin()
) WITH CHECK (
  app.has_role(restaurant_id, ARRAY['owner', 'manager', 'waiter']::member_role[]) OR app.is_superadmin()
);

-- Comandas ---------------------------------------------------------------
CREATE POLICY orders_select ON orders FOR SELECT USING (
  app.is_member(restaurant_id) OR app.is_superadmin()
);
CREATE POLICY orders_insert ON orders FOR INSERT WITH CHECK (
  app.has_role(restaurant_id, ARRAY['owner', 'manager', 'waiter']::member_role[]) OR app.is_superadmin()
);
CREATE POLICY orders_update ON orders FOR UPDATE USING (
  app.has_role(restaurant_id, ARRAY['owner', 'manager']::member_role[]) OR app.is_superadmin()
) WITH CHECK (
  app.has_role(restaurant_id, ARRAY['owner', 'manager']::member_role[]) OR app.is_superadmin()
);

CREATE POLICY order_items_select ON order_items FOR SELECT USING (
  app.is_member(restaurant_id) OR app.is_superadmin()
);
CREATE POLICY order_items_insert ON order_items FOR INSERT WITH CHECK (
  app.has_role(restaurant_id, ARRAY['owner', 'manager', 'waiter']::member_role[]) OR app.is_superadmin()
);
CREATE POLICY order_items_update ON order_items FOR UPDATE USING (
  app.is_member(restaurant_id) OR app.is_superadmin()
) WITH CHECK (
  app.is_member(restaurant_id) OR app.is_superadmin()
);

CREATE POLICY kitchen_events_select ON kitchen_events FOR SELECT USING (
  app.is_member(restaurant_id) OR app.is_superadmin()
);
CREATE POLICY kitchen_events_insert ON kitchen_events FOR INSERT WITH CHECK (
  app.is_member(restaurant_id) OR app.is_superadmin()
);

-- Cuenta -----------------------------------------------------------------
CREATE POLICY bill_requests_select ON bill_requests FOR SELECT USING (
  app.is_member(restaurant_id) OR app.is_superadmin()
);
CREATE POLICY bill_requests_update ON bill_requests FOR UPDATE USING (
  app.has_role(restaurant_id, ARRAY['owner', 'manager', 'waiter']::member_role[]) OR app.is_superadmin()
) WITH CHECK (
  app.has_role(restaurant_id, ARRAY['owner', 'manager', 'waiter']::member_role[]) OR app.is_superadmin()
);

-- Impresión --------------------------------------------------------------
CREATE POLICY printers_select ON printers FOR SELECT USING (
  app.is_member(restaurant_id) OR app.is_superadmin()
);
CREATE POLICY printers_write ON printers FOR ALL USING (
  app.has_role(restaurant_id, ARRAY['owner', 'manager']::member_role[]) OR app.is_superadmin()
) WITH CHECK (
  app.has_role(restaurant_id, ARRAY['owner', 'manager']::member_role[]) OR app.is_superadmin()
);

CREATE POLICY printer_stations_select ON printer_stations FOR SELECT USING (
  app.is_member(restaurant_id) OR app.is_superadmin()
);
CREATE POLICY printer_stations_write ON printer_stations FOR ALL USING (
  app.has_role(restaurant_id, ARRAY['owner', 'manager']::member_role[]) OR app.is_superadmin()
) WITH CHECK (
  app.has_role(restaurant_id, ARRAY['owner', 'manager']::member_role[]) OR app.is_superadmin()
);

CREATE POLICY print_agents_select ON print_agents FOR SELECT USING (
  app.has_role(restaurant_id, ARRAY['owner', 'manager']::member_role[]) OR app.is_superadmin()
);
CREATE POLICY print_agents_write ON print_agents FOR ALL USING (
  app.has_role(restaurant_id, ARRAY['owner', 'manager']::member_role[]) OR app.is_superadmin()
) WITH CHECK (
  app.has_role(restaurant_id, ARRAY['owner', 'manager']::member_role[]) OR app.is_superadmin()
);

CREATE POLICY print_jobs_select ON print_jobs FOR SELECT USING (
  app.is_member(restaurant_id) OR app.is_superadmin()
);
CREATE POLICY print_jobs_insert ON print_jobs FOR INSERT WITH CHECK (
  app.is_member(restaurant_id) OR app.is_superadmin()
);

-- Suscripción y auditoría ------------------------------------------------
CREATE POLICY subscriptions_select ON subscriptions FOR SELECT USING (
  app.has_role(restaurant_id, ARRAY['owner']::member_role[]) OR app.is_superadmin()
);
CREATE POLICY subscriptions_write ON subscriptions FOR ALL USING (
  app.is_superadmin()
) WITH CHECK (
  app.is_superadmin()
);

CREATE POLICY audit_select ON audit_logs FOR SELECT USING (
  app.has_role(restaurant_id, ARRAY['owner', 'manager']::member_role[]) OR app.is_superadmin()
);
CREATE POLICY audit_insert ON audit_logs FOR INSERT WITH CHECK (
  app.is_member(restaurant_id) OR app.is_superadmin()
);

-- Privilegios ------------------------------------------------------------
GRANT USAGE ON SCHEMA public, app TO pase_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pase_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pase_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO pase_app;

-- Sesiones de auth y límites: solo accesibles mediante funciones definer.
REVOKE ALL ON auth_sessions, rate_limits FROM pase_app;
