-- Operaciones de plataforma: alta de restaurantes y personal inicial.
-- Hasta ahora RLS no permitía INSERT en restaurants/app_users ni escribir
-- restaurant_members, así que el panel de superadmin y la invitación de equipo
-- fallaban en tiempo de ejecución.

CREATE POLICY restaurants_insert ON restaurants FOR INSERT WITH CHECK (
  app.is_superadmin()
);

CREATE POLICY members_write ON restaurant_members FOR ALL USING (
  app.has_role(restaurant_id, ARRAY['owner']::member_role[]) OR app.is_superadmin()
) WITH CHECK (
  app.has_role(restaurant_id, ARRAY['owner']::member_role[]) OR app.is_superadmin()
);

CREATE POLICY app_users_insert ON app_users FOR INSERT WITH CHECK (
  app.is_superadmin()
  OR EXISTS (
    SELECT 1 FROM restaurant_members m
    WHERE m.user_id = app.current_user_id()
      AND m.role = 'owner'
  )
);
