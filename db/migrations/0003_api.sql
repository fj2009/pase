-- Pase · API interna y API pública.
-- La API pública (carta, seguimiento, solicitud de cuenta) se expone mediante
-- funciones SECURITY DEFINER con search_path fijo. No concede acceso directo a
-- tablas ni acepta restaurant_id desde el navegador: resuelve el restaurante
-- por slug y la mesa por su token aleatorio.

CREATE SCHEMA IF NOT EXISTS api;

CREATE OR REPLACE FUNCTION api.hit_rate_limit(
  p_key text,
  p_max integer,
  p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_hits integer;
BEGIN
  INSERT INTO rate_limits AS rl (key, window_start, hits)
  VALUES (p_key, now(), 1)
  ON CONFLICT (key) DO UPDATE SET
    hits = CASE
      WHEN rl.window_start < now() - make_interval(secs => p_window_seconds) THEN 1
      ELSE rl.hits + 1
    END,
    window_start = CASE
      WHEN rl.window_start < now() - make_interval(secs => p_window_seconds) THEN now()
      ELSE rl.window_start
    END
  RETURNING rl.hits INTO v_hits;

  RETURN v_hits <= p_max;
END;
$$;

-- Autenticación -----------------------------------------------------------
CREATE OR REPLACE FUNCTION api.authenticate(p_email citext)
RETURNS TABLE (
  user_id uuid,
  password_hash text,
  full_name text,
  is_active boolean,
  is_superadmin boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT u.id, u.password_hash, u.full_name, u.is_active, u.is_superadmin
  FROM app_users u
  WHERE u.email = lower(p_email::text)::citext
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION api.create_auth_session(
  p_user_id uuid,
  p_token_hash text,
  p_user_agent text,
  p_ip text,
  p_hours integer DEFAULT 12
) RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_expires timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_users WHERE id = p_user_id AND is_active) THEN
    RAISE EXCEPTION 'usuario no válido' USING ERRCODE = 'invalid_authorization_specification';
  END IF;

  v_expires := now() + make_interval(hours => p_hours);

  INSERT INTO auth_sessions (user_id, token_hash, user_agent, ip, expires_at)
  VALUES (p_user_id, p_token_hash, p_user_agent, NULLIF(p_ip, '')::inet, v_expires);

  UPDATE app_users SET last_login_at = now() WHERE id = p_user_id;
  RETURN v_expires;
END;
$$;

CREATE OR REPLACE FUNCTION api.resolve_session(p_token_hash text)
RETURNS TABLE (
  session_id uuid,
  user_id uuid,
  email citext,
  full_name text,
  is_superadmin boolean,
  expires_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE auth_sessions s
  SET last_seen_at = now()
  WHERE s.token_hash = p_token_hash
    AND s.revoked_at IS NULL
    AND s.expires_at > now();

  RETURN QUERY
  SELECT s.id, u.id, u.email, u.full_name, u.is_superadmin, s.expires_at
  FROM auth_sessions s
  JOIN app_users u ON u.id = s.user_id
  WHERE s.token_hash = p_token_hash
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND u.is_active
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION api.revoke_session(p_token_hash text)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  UPDATE auth_sessions
  SET revoked_at = now()
  WHERE token_hash = p_token_hash AND revoked_at IS NULL;
$$;

-- Alta y gestión de personal ---------------------------------------------
CREATE OR REPLACE FUNCTION api.create_staff_user(
  p_restaurant_id uuid,
  p_email citext,
  p_password_hash text,
  p_full_name text,
  p_role member_role
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid := app.current_user_id();
  v_user_id uuid;
BEGIN
  IF NOT (app.has_role(p_restaurant_id, ARRAY['owner']::member_role[]) OR app.is_superadmin()) THEN
    RAISE EXCEPTION 'solo el propietario puede crear personal'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_role = 'owner' AND NOT app.is_superadmin() THEN
    RAISE EXCEPTION 'el rol owner solo lo asigna la plataforma'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO app_users (email, password_hash, full_name)
  VALUES (lower(p_email::text)::citext, p_password_hash, p_full_name)
  RETURNING id INTO v_user_id;

  INSERT INTO restaurant_members (restaurant_id, user_id, role)
  VALUES (p_restaurant_id, v_user_id, p_role);

  INSERT INTO audit_logs (restaurant_id, actor_id, actor_label, action, entity, entity_id, metadata)
  VALUES (
    p_restaurant_id, v_actor, 'personal', 'member.created', 'restaurant_member', v_user_id,
    jsonb_build_object('email', p_email, 'role', p_role)
  );

  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION api.set_member_role(
  p_restaurant_id uuid,
  p_user_id uuid,
  p_role member_role
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid := app.current_user_id();
  v_current member_role;
BEGIN
  IF NOT (app.has_role(p_restaurant_id, ARRAY['owner']::member_role[]) OR app.is_superadmin()) THEN
    RAISE EXCEPTION 'solo el propietario puede cambiar roles'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT role INTO v_current FROM restaurant_members
  WHERE restaurant_id = p_restaurant_id AND user_id = p_user_id;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'la persona no pertenece al restaurante' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_current = 'owner' AND p_role <> 'owner'
     AND (SELECT count(*) FROM restaurant_members WHERE restaurant_id = p_restaurant_id AND role = 'owner') <= 1 THEN
    RAISE EXCEPTION 'el restaurante debe conservar al menos un propietario'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE restaurant_members SET role = p_role
  WHERE restaurant_id = p_restaurant_id AND user_id = p_user_id;

  INSERT INTO audit_logs (restaurant_id, actor_id, actor_label, action, entity, entity_id, metadata)
  VALUES (
    p_restaurant_id, v_actor, 'personal', 'member.role_changed', 'restaurant_member', p_user_id,
    jsonb_build_object('from', v_current, 'to', p_role)
  );
END;
$$;

CREATE OR REPLACE FUNCTION api.remove_member(
  p_restaurant_id uuid,
  p_user_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid := app.current_user_id();
  v_role member_role;
BEGIN
  IF NOT (app.has_role(p_restaurant_id, ARRAY['owner']::member_role[]) OR app.is_superadmin()) THEN
    RAISE EXCEPTION 'solo el propietario puede retirar personal'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT role INTO v_role FROM restaurant_members
  WHERE restaurant_id = p_restaurant_id AND user_id = p_user_id;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'la persona no pertenece al restaurante' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_role = 'owner'
     AND (SELECT count(*) FROM restaurant_members WHERE restaurant_id = p_restaurant_id AND role = 'owner') <= 1 THEN
    RAISE EXCEPTION 'el restaurante debe conservar al menos un propietario'
      USING ERRCODE = 'check_violation';
  END IF;

  DELETE FROM restaurant_members
  WHERE restaurant_id = p_restaurant_id AND user_id = p_user_id;

  UPDATE auth_sessions SET revoked_at = now()
  WHERE user_id = p_user_id AND revoked_at IS NULL;

  INSERT INTO audit_logs (restaurant_id, actor_id, actor_label, action, entity, entity_id, metadata)
  VALUES (
    p_restaurant_id, v_actor, 'personal', 'member.removed', 'restaurant_member', p_user_id,
    jsonb_build_object('role', v_role)
  );
END;
$$;

-- Carta pública -----------------------------------------------------------
CREATE OR REPLACE FUNCTION api.menu(
  p_slug text,
  p_qr_token text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_restaurant restaurants%ROWTYPE;
  v_table dining_tables%ROWTYPE;
  v_session service_sessions%ROWTYPE;
  v_categories jsonb;
  v_orders jsonb;
  v_bill jsonb;
BEGIN
  SELECT * INTO v_restaurant
  FROM restaurants
  WHERE slug = p_slug AND is_active;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF p_qr_token IS NOT NULL THEN
    SELECT * INTO v_table
    FROM dining_tables
    WHERE restaurant_id = v_restaurant.id
      AND qr_token = p_qr_token
      AND is_active;
  END IF;

  IF v_table.id IS NOT NULL THEN
    SELECT * INTO v_session
    FROM service_sessions
    WHERE table_id = v_table.id AND status = 'open'
    LIMIT 1;
  END IF;

  SELECT coalesce(jsonb_agg(c ORDER BY c.sort_order, c.name), '[]'::jsonb)
  INTO v_categories
  FROM (
    SELECT
      cat.id,
      cat.name,
      cat.description,
      cat.sort_order,
      coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', i.id,
          'name', i.name,
          'description', i.description,
          'ingredients', i.ingredients,
          'allergens', i.allergens,
          'price_cents', i.price_cents,
          'image_url', i.image_url,
          'prep_minutes', i.prep_minutes,
          'is_available', i.is_available,
          'sort_order', i.sort_order
        ) ORDER BY i.sort_order, i.name)
        FROM menu_items i
        WHERE i.category_id = cat.id
          AND i.restaurant_id = v_restaurant.id
          AND i.is_published
      ), '[]'::jsonb) AS "items"
    FROM menu_categories cat
    WHERE cat.restaurant_id = v_restaurant.id AND cat.is_visible
  ) c;

  IF v_session.id IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(o ORDER BY o.created_at DESC), '[]'::jsonb)
    INTO v_orders
    FROM (
      SELECT
        ord.id,
        ord.order_number,
        ord.status,
        ord.created_at,
        ord.tracking_token,
        ord.tracking_expires_at,
        (SELECT coalesce(sum(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = ord.id AND oi.status <> 'cancelled') AS items_count,
        (SELECT count(*) FROM order_items oi WHERE oi.order_id = ord.id AND oi.status = 'ready') AS ready_count,
        (SELECT coalesce(sum(oi.quantity * oi.unit_price_cents), 0) FROM order_items oi WHERE oi.order_id = ord.id AND oi.status <> 'cancelled') AS total_cents
      FROM orders ord
      WHERE ord.service_session_id = v_session.id
        AND ord.created_at > now() - interval '8 hours'
        AND ord.tracking_expires_at > now()
    ) o;

    SELECT jsonb_build_object('status', b.status, 'requested_at', b.requested_at)
    INTO v_bill
    FROM bill_requests b
    WHERE b.service_session_id = v_session.id
      AND b.status IN ('requested', 'attending')
    ORDER BY b.requested_at DESC
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'restaurant', jsonb_build_object(
      'id', v_restaurant.id,
      'name', v_restaurant.name,
      'slug', v_restaurant.slug,
      'logo_url', v_restaurant.logo_url,
      'accent', v_restaurant.accent,
      'timezone', v_restaurant.timezone,
      'address', v_restaurant.address,
      'phone', v_restaurant.phone
    ),
    'categories', coalesce(v_categories, '[]'::jsonb),
    'table', CASE WHEN v_table.id IS NULL THEN NULL ELSE jsonb_build_object(
      'label', v_table.label,
      'zone', v_table.zone
    ) END,
    'session', CASE WHEN v_session.id IS NULL THEN NULL ELSE jsonb_build_object(
      'opened_at', v_session.opened_at
    ) END,
    'orders', coalesce(v_orders, '[]'::jsonb),
    'bill_request', v_bill,
    'service_open', v_session.id IS NOT NULL
  );
END;
$$;

-- Seguimiento público -----------------------------------------------------
CREATE OR REPLACE FUNCTION api.tracking(p_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_restaurant restaurants%ROWTYPE;
  v_table dining_tables%ROWTYPE;
  v_items jsonb;
  v_backlog jsonb;
BEGIN
  SELECT * INTO v_order FROM orders WHERE tracking_token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_restaurant FROM restaurants WHERE id = v_order.restaurant_id;
  SELECT * INTO v_table FROM dining_tables WHERE id = v_order.table_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', oi.id,
    'name', oi.name_snapshot,
    'quantity', oi.quantity,
    'status', oi.status,
    'prep_minutes', oi.prep_minutes_snapshot,
    'queued_at', oi.queued_at,
    'started_at', oi.started_at,
    'ready_at', oi.ready_at,
    'delivered_at', oi.delivered_at,
    'cancelled_at', oi.cancelled_at,
    'station_id', oi.station_id
  ) ORDER BY oi.queued_at, oi.name_snapshot), '[]'::jsonb)
  INTO v_items
  FROM order_items oi
  WHERE oi.order_id = v_order.id;

  -- Carga agregada por estación (sin nombres ni notas de otras mesas), para
  -- poder estimar la cola sin exponer información de otros clientes.
  SELECT coalesce(jsonb_object_agg(s.station_id, jsonb_build_object(
    'capacity', s.capacity,
    'active_items', s.active_items,
    'remaining_minutes', s.remaining_minutes
  )), '{}'::jsonb)
  INTO v_backlog
  FROM (
    SELECT
      st.id AS station_id,
      st.capacity,
      count(oi.id) AS active_items,
      coalesce(sum(
        CASE
          WHEN oi.status = 'queued' THEN oi.prep_minutes_snapshot
          WHEN oi.status IN ('preparing', 'incident') THEN greatest(
            1,
            oi.prep_minutes_snapshot - (extract(epoch FROM (now() - coalesce(oi.started_at, oi.queued_at))) / 60)::int
          )
          ELSE 0
        END
      ), 0)::int AS remaining_minutes
    FROM kitchen_stations st
    LEFT JOIN order_items oi
      ON oi.station_id = st.id
     AND oi.status IN ('queued', 'preparing')
     AND oi.order_id <> v_order.id
    WHERE st.restaurant_id = v_order.restaurant_id
    GROUP BY st.id, st.capacity
  ) s;

  RETURN jsonb_build_object(
    'order', jsonb_build_object(
      'number', v_order.order_number,
      'status', v_order.status,
      'created_at', v_order.created_at,
      'closed_at', v_order.closed_at,
      'expires_at', v_order.tracking_expires_at,
      'expired', v_order.tracking_expires_at <= now(),
      'total_cents', (SELECT coalesce(sum(quantity * unit_price_cents), 0) FROM order_items WHERE order_id = v_order.id AND status <> 'cancelled')
    ),
    'restaurant', jsonb_build_object('name', v_restaurant.name, 'slug', v_restaurant.slug, 'timezone', v_restaurant.timezone),
    'table', jsonb_build_object('label', v_table.label, 'zone', v_table.zone),
    'items', v_items,
    'station_backlog', v_backlog,
    'generated_at', now()
  );
END;
$$;

-- Solicitud de cuenta -----------------------------------------------------
CREATE OR REPLACE FUNCTION api.request_bill(
  p_slug text,
  p_qr_token text,
  p_idempotency_key text,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_restaurant restaurants%ROWTYPE;
  v_table dining_tables%ROWTYPE;
  v_session service_sessions%ROWTYPE;
  v_existing bill_requests%ROWTYPE;
  v_allowed boolean;
BEGIN
  SELECT * INTO v_restaurant FROM restaurants WHERE slug = p_slug AND is_active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'restaurant_not_found');
  END IF;

  SELECT * INTO v_table
  FROM dining_tables
  WHERE restaurant_id = v_restaurant.id AND qr_token = p_qr_token AND is_active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'table_not_found');
  END IF;

  SELECT * INTO v_session
  FROM service_sessions
  WHERE table_id = v_table.id AND status = 'open'
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'service_closed');
  END IF;

  v_allowed := api.hit_rate_limit('bill:' || v_session.id::text, 4, 60);
  IF NOT v_allowed THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
  END IF;

  SELECT * INTO v_existing
  FROM bill_requests
  WHERE service_session_id = v_session.id
    AND status IN ('requested', 'attending')
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'status', v_existing.status);
  END IF;

  INSERT INTO bill_requests (
    restaurant_id, table_id, service_session_id, status, note, idempotency_key
  ) VALUES (
    v_restaurant.id, v_table.id, v_session.id, 'requested', NULLIF(p_note, ''), p_idempotency_key
  )
  ON CONFLICT (restaurant_id, idempotency_key) DO NOTHING
  RETURNING * INTO v_existing;

  IF NOT FOUND THEN
    SELECT * INTO v_existing
    FROM bill_requests
    WHERE restaurant_id = v_restaurant.id AND idempotency_key = p_idempotency_key
    LIMIT 1;
  END IF;

  INSERT INTO audit_logs (restaurant_id, actor_label, action, entity, entity_id, metadata)
  VALUES (
    v_restaurant.id, 'cliente (QR)', 'bill.requested', 'bill_request', v_existing.id,
    jsonb_build_object('table', v_table.label)
  );

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'status', v_existing.status);
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM bill_requests
    WHERE service_session_id = v_session.id
      AND status IN ('requested', 'attending')
    LIMIT 1;
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'status', coalesce(v_existing.status, 'requested'));
END;
$$;

GRANT USAGE ON SCHEMA api TO pase_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA api TO pase_app;
