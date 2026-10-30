-- Datos de demostración. Solo para desarrollo: nunca ejecutar en producción.
-- Todos los contenidos, alérgenos y precios son ficticios y deben sustituirse
-- por los datos confirmados por el establecimiento.

TRUNCATE TABLE
  audit_logs, kitchen_events, order_items, orders, bill_requests,
  print_jobs, print_agents, printer_stations, printers,
  menu_items, menu_categories, service_sessions, dining_tables,
  kitchen_stations, restaurant_members, subscriptions, restaurants,
  auth_sessions, app_users, rate_limits
CASCADE;

-- Usuarios ---------------------------------------------------------------
-- Contraseña de demostración para todas las cuentas: PaseDemo2026!
INSERT INTO app_users (id, email, password_hash, full_name, is_superadmin) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'owner@casa-aurelio.es',  '$2b$10$2uRyqir32vtrb.8zFGbikO3rvsAz.YG1axmilqVRXPZCdCEeKtlfq', 'Aurelio Marín', false),
  ('a1000000-0000-4000-8000-000000000002', 'encargada@casa-aurelio.es', '$2b$10$2uRyqir32vtrb.8zFGbikO3rvsAz.YG1axmilqVRXPZCdCEeKtlfq', 'Lucía Ferrer', false),
  ('a1000000-0000-4000-8000-000000000003', 'sala@casa-aurelio.es',    '$2b$10$2uRyqir32vtrb.8zFGbikO3rvsAz.YG1axmilqVRXPZCdCEeKtlfq', 'Marcos Vidal', false),
  ('a1000000-0000-4000-8000-000000000004', 'cocina@casa-aurelio.es',  '$2b$10$2uRyqir32vtrb.8zFGbikO3rvsAz.YG1axmilqVRXPZCdCEeKtlfq', 'Nuria Sanz', false),
  ('b1000000-0000-4000-8000-000000000001', 'owner@lachispa.es',       '$2b$10$2uRyqir32vtrb.8zFGbikO3rvsAz.YG1axmilqVRXPZCdCEeKtlfq', 'Diego Prats', false),
  ('f1000000-0000-4000-8000-000000000001', 'admin@pase.app',          '$2b$10$2uRyqir32vtrb.8zFGbikO3rvsAz.YG1axmilqVRXPZCdCEeKtlfq', 'Equipo Pase', true);

-- Restaurantes -----------------------------------------------------------
INSERT INTO restaurants (id, name, slug, address, phone, timezone, accent, logo_url) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Casa Aurelio', 'casa-aurelio',
   'Calle del Almendro 14, Madrid', '+34 910 000 014', 'Europe/Madrid', 'olive', NULL),
  ('b0000000-0000-4000-8000-000000000001', 'Bar La Chispa', 'la-chispa',
   'Plaza de la Luz 3, Valencia', '+34 960 000 003', 'Europe/Madrid', 'terracotta', NULL);

INSERT INTO restaurant_members (restaurant_id, user_id, role) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'owner'),
  ('a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'manager'),
  ('a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', 'waiter'),
  ('a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000004', 'kitchen'),
  ('b0000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'owner');

INSERT INTO subscriptions (restaurant_id, plan, status, seats, current_period_end) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'pro', 'active', 12, now() + interval '28 days'),
  ('b0000000-0000-4000-8000-000000000001', 'trial', 'trialing', 4, now() + interval '9 days');

-- Estaciones -------------------------------------------------------------
INSERT INTO kitchen_stations (id, restaurant_id, name, capacity, sort_order) VALUES
  ('a5000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Cocina', 2, 1),
  ('a5000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Barra', 2, 2),
  ('a5000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Postres', 1, 3),
  ('b5000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Cocina', 1, 1);

-- Impresoras y agentes ---------------------------------------------------
INSERT INTO printers (id, restaurant_id, name, kind, target, paper_width) VALUES
  ('a4000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Cocina principal', 'test', 'agent/out/cocina', 80),
  ('a4000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Barra', 'test', 'agent/out/barra', 80),
  ('b4000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Cocina', 'test', 'agent/out/chispa', 80);

INSERT INTO printer_stations (printer_id, station_id, restaurant_id) VALUES
  ('a4000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('a4000000-0000-4000-8000-000000000002', 'a5000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001'),
  ('b4000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001');

-- Token de agente de desarrollo: pase_dev_agent_casa_aurelio
INSERT INTO print_agents (restaurant_id, name, token_hash) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Agente de cocina (demo)', 'be37b2c406253fd1963722ac5a2a525f902ff33c19e1a88f1c32fecb551ecc8b'),
  ('b0000000-0000-4000-8000-000000000001', 'Agente La Chispa (demo)', '2146931bc67e03d5a1a3bb4de73f2494d8ce871ce382713d894b48073caad9f5');

-- Mesas ------------------------------------------------------------------
INSERT INTO dining_tables (id, restaurant_id, label, zone, seats, qr_token) VALUES
  ('aa000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Mesa 1', 'Sala', 2, 'casa01f3a9b27c4e5d8610a2b3c4d5e6f708'),
  ('aa000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Mesa 2', 'Sala', 2, 'casa02a8b7c6d5e4f3021b9a8c7d6e5f4a302'),
  ('aa000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Mesa 3', 'Sala', 4, 'casa03b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5'),
  ('aa000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'Mesa 4', 'Sala', 4, 'casa04c4d5e6f708192a3b4c5d6e7f8091a2b'),
  ('aa000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'Mesa 5', 'Terraza', 2, 'casa05d7e8f9012a3b4c5d6e7f8091a2b3c4d'),
  ('aa000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'Mesa 6', 'Terraza', 2, 'casa06e1f2a3b4c5d6e7f8091a2b3c4d5e6f7'),
  ('aa000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'Mesa 7', 'Terraza', 6, 'casa07f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8'),
  ('aa000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001', 'Mesa 8', 'Barra', 1, 'casa080a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5'),
  ('bb000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Mesa 1', 'Sala', 2, 'chispa01a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d'),
  ('bb000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'Mesa 2', 'Sala', 4, 'chispa02b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e');

-- Categorías -------------------------------------------------------------
INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order) VALUES
  ('a6000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Para empezar', 'Bocados de barra y platos para compartir.', 1),
  ('a6000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Del mar', 'Pescado y marisco de lonja, según temporada.', 2),
  ('a6000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'De la huerta', 'Verdura de mercado y arroces.', 3),
  ('a6000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'Postres', 'Elaboración propia, cada día.', 4),
  ('a6000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'Bebidas', 'Vermut, vinos por copa y agua.', 5),
  ('b6000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Barra', 'Para picar.', 1);

-- Carta Casa Aurelio -----------------------------------------------------
INSERT INTO menu_items
  (id, restaurant_id, category_id, station_id, name, description, ingredients, allergens, price_cents, image_url, prep_minutes, is_available, sort_order)
VALUES
  ('a7000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001',
   'Croquetas de jamón ibérico', 'Cremosas por dentro, con una corteza fina y crujiente. Seis unidades.',
   'Jamón ibérico, leche, harina de trigo, mantequilla, cebolla y nuez moscada.', ARRAY['gluten','lacteos'], 950, '/demo/croquetas.jpg', 8, true, 1),
  ('a7000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001',
   'Tortilla de patata y cebolla', 'Jugosa, con la cebolla bien pochada. Ración para compartir.',
   'Patata, huevo, cebolla y aceite de oliva.', ARRAY['huevos'], 700, '/demo/tortilla.jpg', 10, true, 2),
  ('a7000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000002',
   'Gilda de anchoa', 'Pepinillo, aceituna y anchoa encurtida. Un bocado salino para abrir boca.',
   'Anchoa en salazón, aceituna manzanilla, pepinillo y guindilla.', ARRAY['pescado','sulfitos'], 380, '/demo/gilda.jpg', 4, true, 3),
  ('a7000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000002',
   'Pan de masa madre', 'Hogaza de fermentación lenta, servida templada con aceite de oliva virgen extra.',
   'Harina de trigo, agua, sal y masa madre.', ARRAY['gluten'], 320, '/demo/pan.jpg', 3, true, 4),
  ('a7000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000002', 'a5000000-0000-4000-8000-000000000001',
   'Pulpo a la brasa', 'Pulpo cocido y marcado al fuego, con patata confitada y pimentón.',
   'Pulpo, patata, aceite de oliva, pimentón y sal.', ARRAY['moluscos'], 1850, '/demo/pulpo.jpg', 18, true, 1),
  ('a7000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000002', 'a5000000-0000-4000-8000-000000000001',
   'Gambas al ajillo', 'Gambas salteadas con ajo laminado y guindilla, en cazuela de barro.',
   'Gambas, ajo, guindilla, aceite de oliva y perejil.', ARRAY['crustaceos'], 1300, '/demo/gambas.jpg', 9, false, 2),
  ('a7000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000002', 'a5000000-0000-4000-8000-000000000001',
   'Merluza en salsa verde', 'Lomo de merluza con almejas, guisantes y un fondo suave de perejil.',
   'Merluza, almejas, guisantes, harina, ajo, perejil y aceite de oliva.', ARRAY['pescado','moluscos','gluten'], 1650, NULL, 14, true, 3),
  ('a7000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000003', 'a5000000-0000-4000-8000-000000000002',
   'Tomate y burrata', 'Tomate de temporada, burrata cremosa, albahaca y aceite de oliva.',
   'Tomate, burrata, albahaca, aceite de oliva, sal y pimienta.', ARRAY['lacteos'], 1100, '/demo/burrata.jpg', 6, true, 1),
  ('a7000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000003', 'a5000000-0000-4000-8000-000000000001',
   'Pimientos de Padrón', 'Salteados con sal en escamas. Algunos pican.',
   'Pimiento de Padrón, aceite de oliva y sal.', ARRAY[]::text[], 650, NULL, 7, true, 2),
  ('a7000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000003', 'a5000000-0000-4000-8000-000000000001',
   'Arroz de verduras', 'Arroz bomba con caldo de verduras, alcachofa y judía verde. Mínimo dos personas.',
   'Arroz bomba, caldo de verduras, alcachofa, judía verde, cebolla y aceite de oliva.', ARRAY['apio'], 1350, '/demo/arroz.jpg', 16, true, 3),
  ('a7000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000004', 'a5000000-0000-4000-8000-000000000003',
   'Tarta de queso al horno', 'Cremosa en el centro, con base de galleta y mermelada de frutos rojos.',
   'Queso crema, nata, huevo, azúcar, galleta de trigo, mantequilla y frutos rojos.', ARRAY['lacteos','huevos','gluten'], 650, '/demo/tarta.jpg', 5, true, 1),
  ('a7000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000004', 'a5000000-0000-4000-8000-000000000003',
   'Torrija caramelizada', 'Pan brioche empapado en leche, caramelizado al momento y servido templado.',
   'Pan brioche, leche, huevo, azúcar, canela y mantequilla.', ARRAY['gluten','lacteos','huevos'], 600, NULL, 8, true, 2),
  ('a7000000-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000005', 'a5000000-0000-4000-8000-000000000002',
   'Vermut de grifo', 'Vermut rojo de la casa, servido con naranja y una aceituna.',
   'Vermut, naranja y aceituna.', ARRAY['sulfitos'], 350, NULL, 2, true, 1),
  ('a7000000-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000005', 'a5000000-0000-4000-8000-000000000002',
   'Agua de manantial 50 cl', 'Botella de vidrio, fría o del tiempo.',
   'Agua mineral natural.', ARRAY[]::text[], 250, NULL, 1, true, 2);

-- Carta Bar La Chispa (aislamiento) --------------------------------------
INSERT INTO menu_items
  (id, restaurant_id, category_id, station_id, name, description, ingredients, allergens, price_cents, prep_minutes, is_available, sort_order)
VALUES
  ('b7000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'b6000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001',
   'Patatas bravas', 'Patata frita con salsa brava de la casa.', 'Patata, tomate, pimentón y aceite.', ARRAY[]::text[], 550, 9, true, 1),
  ('b7000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'b6000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001',
   'Caña de cerveza', 'Cerveza de barril bien fría.', 'Cebada y lúpulo.', ARRAY['gluten'], 200, 1, true, 2);

-- Servicio abierto en la mesa 4 de Casa Aurelio --------------------------
INSERT INTO service_sessions (id, restaurant_id, table_id, status, opened_at, opened_by) VALUES
  ('a9000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'aa000000-0000-4000-8000-000000000004', 'open', now() - interval '34 minutes',
   'a1000000-0000-4000-8000-000000000003');

INSERT INTO orders
  (id, restaurant_id, table_id, service_session_id, order_number, status, tracking_token, tracking_expires_at, idempotency_key, created_by, created_at)
VALUES
  ('a8000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'aa000000-0000-4000-8000-000000000004', 'a9000000-0000-4000-8000-000000000001',
   1, 'open', 'demo_tracking_casa_aurelio_000001', now() + interval '18 hours',
   'seed-order-1', 'a1000000-0000-4000-8000-000000000003', now() - interval '26 minutes');

INSERT INTO order_items
  (id, restaurant_id, order_id, menu_item_id, station_id, name_snapshot, unit_price_cents,
   prep_minutes_snapshot, quantity, notes, status, queued_at, started_at, ready_at, delivered_at, created_by)
VALUES
  ('a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'a8000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001',
   'a5000000-0000-4000-8000-000000000001', 'Croquetas de jamón ibérico', 950, 8, 2,
   'Bien hechas, sin exceso de aceite.', 'delivered',
   now() - interval '26 minutes', now() - interval '25 minutes', now() - interval '19 minutes', now() - interval '16 minutes',
   'a1000000-0000-4000-8000-000000000003'),
  ('a3000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'a8000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000005',
   'a5000000-0000-4000-8000-000000000001', 'Pulpo a la brasa', 1850, 18, 1,
   NULL, 'preparing',
   now() - interval '26 minutes', now() - interval '11 minutes', NULL, NULL,
   'a1000000-0000-4000-8000-000000000003'),
  ('a3000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'a8000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000011',
   'a5000000-0000-4000-8000-000000000003', 'Tarta de queso al horno', 650, 5, 1,
   'Sin mermelada.', 'queued',
   now() - interval '26 minutes', NULL, NULL, NULL,
   'a1000000-0000-4000-8000-000000000003');

INSERT INTO kitchen_events (restaurant_id, order_item_id, from_status, to_status, actor_id, created_at) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', NULL, 'queued', 'a1000000-0000-4000-8000-000000000003', now() - interval '26 minutes'),
  ('a0000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'queued', 'preparing', 'a1000000-0000-4000-8000-000000000004', now() - interval '25 minutes'),
  ('a0000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'preparing', 'ready', 'a1000000-0000-4000-8000-000000000004', now() - interval '19 minutes'),
  ('a0000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'ready', 'delivered', 'a1000000-0000-4000-8000-000000000003', now() - interval '16 minutes'),
  ('a0000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000002', NULL, 'queued', 'a1000000-0000-4000-8000-000000000003', now() - interval '26 minutes'),
  ('a0000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000002', 'queued', 'preparing', 'a1000000-0000-4000-8000-000000000004', now() - interval '11 minutes'),
  ('a0000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000003', NULL, 'queued', 'a1000000-0000-4000-8000-000000000003', now() - interval '26 minutes');

INSERT INTO audit_logs (restaurant_id, actor_id, actor_label, action, entity, metadata, created_at) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', 'personal', 'order.created', 'order',
   jsonb_build_object('order_number', 1, 'table', 'Mesa 4'), now() - interval '26 minutes'),
  ('a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'personal', 'menu.updated', 'menu_item',
   jsonb_build_object('name', 'Gambas al ajillo', 'available', false), now() - interval '2 hours');
