-- El alta de personal la hace un propietario, pero no puede crear filas en
-- app_users directamente sin abrir una política de INSERT demasiado amplia.
-- Esta función comprueba el rol sobre el restaurante concreto y crea la cuenta
-- con privilegios definer, manteniendo el aislamiento por restaurante.

CREATE OR REPLACE FUNCTION api.create_staff_user(
  p_restaurant_id uuid,
  p_email text,
  p_full_name text,
  p_password_hash text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT (
    app.has_role(p_restaurant_id, ARRAY['owner']::member_role[])
    OR app.is_superadmin()
  ) THEN
    RAISE EXCEPTION 'sin permisos para crear personal'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO app_users (email, password_hash, full_name, must_change_password)
  VALUES (p_email::citext, p_password_hash, p_full_name, true)
  RETURNING id INTO v_user_id;

  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION api.create_staff_user(uuid, text, text, text) TO pase_app;

DROP POLICY IF EXISTS app_users_insert ON app_users;
CREATE POLICY app_users_insert ON app_users FOR INSERT WITH CHECK (
  app.is_superadmin()
);
