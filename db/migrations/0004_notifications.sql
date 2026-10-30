-- Notificaciones en tiempo real mediante LISTEN/NOTIFY de PostgreSQL.
-- Un único canal transporta eventos ligeros; cada suscriptor filtra por
-- restaurante o por token de seguimiento.

CREATE OR REPLACE FUNCTION app_notify_order()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('pase_events', jsonb_build_object(
    'topic', 'orders',
    'restaurant_id', NEW.restaurant_id,
    'order_id', NEW.id,
    'table_id', NEW.table_id,
    'status', NEW.status,
    'tracking_token', NEW.tracking_token
  )::text);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app_notify_item()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('pase_events', jsonb_build_object(
    'topic', 'items',
    'restaurant_id', NEW.restaurant_id,
    'order_id', NEW.order_id,
    'item_id', NEW.id,
    'status', NEW.status,
    'tracking_token', (SELECT tracking_token FROM orders WHERE id = NEW.order_id)
  )::text);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app_notify_bill()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('pase_events', jsonb_build_object(
    'topic', 'bills',
    'restaurant_id', NEW.restaurant_id,
    'bill_id', NEW.id,
    'table_id', NEW.table_id,
    'status', NEW.status
  )::text);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app_notify_print()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('pase_events', jsonb_build_object(
    'topic', 'print',
    'restaurant_id', NEW.restaurant_id,
    'job_id', NEW.id,
    'status', NEW.status
  )::text);
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_notify_insert AFTER INSERT ON orders
FOR EACH ROW EXECUTE FUNCTION app_notify_order();
CREATE TRIGGER orders_notify_update AFTER UPDATE OF status ON orders
FOR EACH ROW EXECUTE FUNCTION app_notify_order();
CREATE TRIGGER order_items_notify_insert AFTER INSERT ON order_items
FOR EACH ROW EXECUTE FUNCTION app_notify_item();
CREATE TRIGGER order_items_notify_update AFTER UPDATE OF status ON order_items
FOR EACH ROW EXECUTE FUNCTION app_notify_item();
CREATE TRIGGER bill_requests_notify_insert AFTER INSERT ON bill_requests
FOR EACH ROW EXECUTE FUNCTION app_notify_bill();
CREATE TRIGGER bill_requests_notify_update AFTER UPDATE OF status ON bill_requests
FOR EACH ROW EXECUTE FUNCTION app_notify_bill();
CREATE TRIGGER print_jobs_notify_insert AFTER INSERT ON print_jobs
FOR EACH ROW EXECUTE FUNCTION app_notify_print();
CREATE TRIGGER print_jobs_notify_update AFTER UPDATE OF status ON print_jobs
FOR EACH ROW EXECUTE FUNCTION app_notify_print();
