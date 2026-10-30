import "server-only";

import { userQuery } from "@/lib/db";
import type { ItemStatus } from "@/features/orders/state-machine";
import { ACTIVE_STATUSES } from "@/features/orders/state-machine";

export interface OrderItemView {
  id: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  status: ItemStatus;
  notes: string | null;
  stationId: string;
  stationName: string;
  prepMinutes: number;
  queuedAt: string;
  startedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  incidentNote: string | null;
  cancelReason: string | null;
}

export interface OrderView {
  id: string;
  number: number;
  tableId: string;
  tableLabel: string;
  status: "open" | "closed" | "cancelled";
  createdAt: string;
  notes: string | null;
  trackingToken: string;
  items: OrderItemView[];
  totalCents: number;
}

export interface KitchenOrder extends OrderView {
  pendingCount: number;
  readyCount: number;
  earliestQueuedAt: string;
}

export interface StationView {
  id: string;
  name: string;
  capacity: number;
  sortOrder: number;
}

export interface KitchenBoard {
  orders: KitchenOrder[];
  stations: StationView[];
  stats: {
    queued: number;
    preparing: number;
    incident: number;
    ready: number;
    oldestMinutes: number;
  };
}

interface ItemRow {
  id: string;
  order_id: string;
  name_snapshot: string;
  quantity: number;
  unit_price_cents: number;
  status: ItemStatus;
  notes: string | null;
  station_id: string;
  station_name: string;
  prep_minutes_snapshot: number;
  queued_at: Date;
  started_at: Date | null;
  ready_at: Date | null;
  delivered_at: Date | null;
  incident_note: string | null;
  cancel_reason: string | null;
}

interface OrderRow {
  id: string;
  order_number: number;
  table_id: string;
  table_label: string;
  status: "open" | "closed" | "cancelled";
  created_at: Date;
  notes: string | null;
  tracking_token: string;
}

function mapItem(row: ItemRow): OrderItemView {
  return {
    id: row.id,
    name: row.name_snapshot,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
    status: row.status,
    notes: row.notes,
    stationId: row.station_id,
    stationName: row.station_name,
    prepMinutes: row.prep_minutes_snapshot,
    queuedAt: row.queued_at.toISOString(),
    startedAt: row.started_at?.toISOString() ?? null,
    readyAt: row.ready_at?.toISOString() ?? null,
    deliveredAt: row.delivered_at?.toISOString() ?? null,
    incidentNote: row.incident_note,
    cancelReason: row.cancel_reason,
  };
}

function mapOrder(row: OrderRow, items: OrderItemView[]): OrderView {
  return {
    id: row.id,
    number: row.order_number,
    tableId: row.table_id,
    tableLabel: row.table_label,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    notes: row.notes,
    trackingToken: row.tracking_token,
    items,
    totalCents: items
      .filter((item) => item.status !== "cancelled")
      .reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0),
  };
}

export async function getKitchenBoard(userId: string, restaurantId: string): Promise<KitchenBoard> {
  const [stationRows, orderRows, itemRows] = await Promise.all([
    userQuery<{ id: string; name: string; capacity: number; sort_order: number }>(
      userId,
      `SELECT id, name, capacity, sort_order FROM kitchen_stations
       WHERE restaurant_id = $1 AND is_active ORDER BY sort_order, name`,
      [restaurantId],
    ),
    userQuery<OrderRow>(
      userId,
      `SELECT o.id, o.order_number, o.table_id, t.label AS table_label, o.status,
              o.created_at, o.notes, o.tracking_token
       FROM orders o
       JOIN dining_tables t ON t.id = o.table_id
       WHERE o.restaurant_id = $1 AND o.status = 'open'
       ORDER BY o.created_at ASC`,
      [restaurantId],
    ),
    userQuery<ItemRow>(
      userId,
      `SELECT oi.id, oi.order_id, oi.name_snapshot, oi.quantity, oi.unit_price_cents,
              oi.status, oi.notes, oi.station_id, ks.name AS station_name,
              oi.prep_minutes_snapshot, oi.queued_at, oi.started_at, oi.ready_at,
              oi.delivered_at, oi.incident_note, oi.cancel_reason
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN kitchen_stations ks ON ks.id = oi.station_id
       WHERE oi.restaurant_id = $1
         AND o.status = 'open'
         AND oi.status = ANY($2::order_item_status[])
       ORDER BY oi.queued_at ASC`,
      [restaurantId, ACTIVE_STATUSES],
    ),
  ]);

  const itemsByOrder = new Map<string, OrderItemView[]>();
  for (const row of itemRows) {
    const list = itemsByOrder.get(row.order_id) ?? [];
    list.push(mapItem(row));
    itemsByOrder.set(row.order_id, list);
  }

  const orders: KitchenOrder[] = [];
  for (const row of orderRows) {
    const items = itemsByOrder.get(row.id) ?? [];
    if (items.length === 0) continue;
    const order = mapOrder(row, items);
    orders.push({
      ...order,
      pendingCount: items.filter((item) =>
        ["queued", "preparing", "incident"].includes(item.status),
      ).length,
      readyCount: items.filter((item) => item.status === "ready").length,
      earliestQueuedAt: items[0]?.queuedAt ?? row.created_at.toISOString(),
    });
  }

  const oldest = itemRows.reduce((min, row) => Math.min(min, row.queued_at.getTime()), Date.now());
  const stats = {
    queued: itemRows.filter((row) => row.status === "queued").length,
    preparing: itemRows.filter((row) => row.status === "preparing").length,
    incident: itemRows.filter((row) => row.status === "incident").length,
    ready: itemRows.filter((row) => row.status === "ready").length,
    oldestMinutes: Math.max(0, Math.floor((Date.now() - oldest) / 60_000)),
  };

  return {
    orders,
    stations: stationRows.map((row) => ({
      id: row.id,
      name: row.name,
      capacity: row.capacity,
      sortOrder: row.sort_order,
    })),
    stats,
  };
}

export interface SalaTable {
  id: string;
  label: string;
  zone: string | null;
  seats: number;
  qrToken: string;
  sessionId: string | null;
  openedAt: string | null;
  orders: number;
  pendingItems: number;
  readyItems: number;
  totalCents: number;
  lastOrderNumber: number | null;
  billStatus: "requested" | "attending" | null;
}

export interface ActiveBill {
  id: string;
  status: "requested" | "attending" | "completed" | "cancelled";
  requestedAt: string;
  attendedAt: string | null;
  note: string | null;
  tableId: string;
  tableLabel: string;
  zone: string | null;
  sessionId: string;
  orders: number;
  totalCents: number;
}

export interface SalaOverview {
  tables: SalaTable[];
  bills: ActiveBill[];
  stats: {
    openTables: number;
    activeOrders: number;
    pendingItems: number;
    readyItems: number;
    billRequests: number;
  };
}

export async function getSalaOverview(
  userId: string,
  restaurantId: string,
): Promise<SalaOverview> {
  const [tableRows, aggregates, billRows] = await Promise.all([
    userQuery<{
      id: string;
      label: string;
      zone: string | null;
      seats: number;
      qr_token: string;
      session_id: string | null;
      opened_at: Date | null;
    }>(
      userId,
      `SELECT t.id, t.label, t.zone, t.seats, t.qr_token,
              ss.id AS session_id, ss.opened_at
       FROM dining_tables t
       LEFT JOIN service_sessions ss ON ss.table_id = t.id AND ss.status = 'open'
       WHERE t.restaurant_id = $1 AND t.is_active
       ORDER BY t.zone NULLS LAST, t.label`,
      [restaurantId],
    ),
    userQuery<{
      table_id: string;
      session_id: string;
      orders: number;
      pending_items: number;
      ready_items: number;
      total_cents: number;
      last_order_number: number | null;
    }>(
      userId,
      `SELECT o.table_id, o.service_session_id AS session_id,
              count(DISTINCT o.id)::int AS orders,
              count(oi.id) FILTER (WHERE oi.status IN ('queued', 'preparing', 'incident'))::int AS pending_items,
              count(oi.id) FILTER (WHERE oi.status = 'ready')::int AS ready_items,
              COALESCE(sum(oi.quantity * oi.unit_price_cents) FILTER (WHERE oi.status <> 'cancelled'), 0)::int AS total_cents,
              max(o.order_number)::int AS last_order_number
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.restaurant_id = $1 AND o.status = 'open'
       GROUP BY o.table_id, o.service_session_id`,
      [restaurantId],
    ),
    userQuery<{
      id: string;
      status: "requested" | "attending";
      requested_at: Date;
      attended_at: Date | null;
      note: string | null;
      table_id: string;
      table_label: string;
      zone: string | null;
      session_id: string;
      orders: number;
      total_cents: number;
    }>(
      userId,
      `SELECT b.id, b.status, b.requested_at, b.attended_at, b.note,
              t.id AS table_id, t.label AS table_label, t.zone,
              b.service_session_id AS session_id,
              (SELECT count(*)::int FROM orders o
                WHERE o.service_session_id = b.service_session_id AND o.status = 'open') AS orders,
              (SELECT COALESCE(sum(oi.quantity * oi.unit_price_cents), 0)::int
                FROM order_items oi JOIN orders o ON o.id = oi.order_id
                WHERE o.service_session_id = b.service_session_id
                  AND o.status = 'open' AND oi.status <> 'cancelled') AS total_cents
       FROM bill_requests b
       JOIN dining_tables t ON t.id = b.table_id
       WHERE b.restaurant_id = $1 AND b.status IN ('requested', 'attending')
       ORDER BY b.requested_at ASC`,
      [restaurantId],
    ),
  ]);

  const bySession = new Map(aggregates.map((row) => [row.session_id, row]));
  const billBySession = new Map(billRows.map((row) => [row.session_id, row.status]));

  const tables: SalaTable[] = tableRows.map((row) => {
    const stats = row.session_id ? bySession.get(row.session_id) : undefined;
    return {
      id: row.id,
      label: row.label,
      zone: row.zone,
      seats: row.seats,
      qrToken: row.qr_token,
      sessionId: row.session_id,
      openedAt: row.opened_at?.toISOString() ?? null,
      orders: stats?.orders ?? 0,
      pendingItems: stats?.pending_items ?? 0,
      readyItems: stats?.ready_items ?? 0,
      totalCents: stats?.total_cents ?? 0,
      lastOrderNumber: stats?.last_order_number ?? null,
      billStatus: row.session_id
        ? (billBySession.get(row.session_id) as "requested" | "attending" | undefined) ?? null
        : null,
    };
  });

  return {
    tables,
    bills: billRows.map((row) => ({
      id: row.id,
      status: row.status,
      requestedAt: row.requested_at.toISOString(),
      attendedAt: row.attended_at?.toISOString() ?? null,
      note: row.note,
      tableId: row.table_id,
      tableLabel: row.table_label,
      zone: row.zone,
      sessionId: row.session_id,
      orders: row.orders,
      totalCents: row.total_cents,
    })),
    stats: {
      openTables: tables.filter((table) => table.sessionId).length,
      activeOrders: tables.reduce((sum, table) => sum + table.orders, 0),
      pendingItems: tables.reduce((sum, table) => sum + table.pendingItems, 0),
      readyItems: tables.reduce((sum, table) => sum + table.readyItems, 0),
      billRequests: tables.filter((table) => table.billStatus).length,
    },
  };
}

export interface ComposerItem {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  prepMinutes: number;
  stationId: string;
  stationName: string;
  allergens: string[];
  isAvailable: boolean;
}

export interface ComposerCategory {
  id: string;
  name: string;
  items: ComposerItem[];
}

export interface TableDetail {
  table: {
    id: string;
    label: string;
    zone: string | null;
    seats: number;
    qrToken: string;
  };
  session: { id: string; openedAt: string } | null;
  orders: OrderView[];
  totalCents: number;
  bill: { id: string; status: string; requestedAt: string; note: string | null } | null;
  categories: ComposerCategory[];
  stations: StationView[];
}

export async function getTableDetail(
  userId: string,
  restaurantId: string,
  tableId: string,
): Promise<TableDetail | null> {
  const tableRows = await userQuery<{
    id: string;
    label: string;
    zone: string | null;
    seats: number;
    qr_token: string;
    session_id: string | null;
    opened_at: Date | null;
  }>(
    userId,
    `SELECT t.id, t.label, t.zone, t.seats, t.qr_token,
            ss.id AS session_id, ss.opened_at
     FROM dining_tables t
     LEFT JOIN service_sessions ss ON ss.table_id = t.id AND ss.status = 'open'
     WHERE t.id = $1 AND t.restaurant_id = $2`,
    [tableId, restaurantId],
  );
  const table = tableRows[0];
  if (!table) return null;

  const [menuRows, itemRows, stationRows, billRows] = await Promise.all([
    userQuery<{
      category_id: string;
      category_name: string;
      item_id: string;
      name: string;
      description: string | null;
      price_cents: number;
      prep_minutes: number;
      station_id: string;
      station_name: string;
      allergens: string[];
      is_available: boolean;
    }>(
      userId,
      `SELECT c.id AS category_id, c.name AS category_name,
              mi.id AS item_id, mi.name, mi.description, mi.price_cents, mi.prep_minutes,
              mi.station_id, ks.name AS station_name, mi.allergens, mi.is_available
       FROM menu_categories c
       LEFT JOIN menu_items mi ON mi.category_id = c.id AND mi.is_published
       LEFT JOIN kitchen_stations ks ON ks.id = mi.station_id
       WHERE c.restaurant_id = $1 AND c.is_visible
       ORDER BY c.sort_order, c.name, mi.sort_order, mi.name`,
      [restaurantId],
    ),
    userQuery<ItemRow>(
      userId,
      `SELECT oi.id, oi.order_id, oi.name_snapshot, oi.quantity, oi.unit_price_cents,
              oi.status, oi.notes, oi.station_id, ks.name AS station_name,
              oi.prep_minutes_snapshot, oi.queued_at, oi.started_at, oi.ready_at,
              oi.delivered_at, oi.incident_note, oi.cancel_reason
       FROM order_items oi
       JOIN kitchen_stations ks ON ks.id = oi.station_id
       WHERE oi.restaurant_id = $1
         AND oi.order_id IN (
           SELECT id FROM orders WHERE service_session_id = $2 AND restaurant_id = $1
         )
       ORDER BY oi.queued_at`,
      [restaurantId, table.session_id],
    ),
    userQuery<{ id: string; name: string; capacity: number; sort_order: number }>(
      userId,
      `SELECT id, name, capacity, sort_order FROM kitchen_stations
       WHERE restaurant_id = $1 AND is_active ORDER BY sort_order, name`,
      [restaurantId],
    ),
    table.session_id
      ? userQuery<{ id: string; status: string; requested_at: Date; note: string | null }>(
          userId,
          `SELECT id, status, requested_at, note FROM bill_requests
           WHERE service_session_id = $1 AND restaurant_id = $2
             AND status IN ('requested', 'attending')
           ORDER BY requested_at DESC LIMIT 1`,
          [table.session_id, restaurantId],
        )
      : Promise.resolve([]),
  ]);

  let orders: OrderView[] = [];
  if (table.session_id) {
    const orderRows = await userQuery<OrderRow>(
      userId,
      `SELECT o.id, o.order_number, o.table_id, t.label AS table_label, o.status,
              o.created_at, o.notes, o.tracking_token
       FROM orders o
       JOIN dining_tables t ON t.id = o.table_id
       WHERE o.service_session_id = $1 AND o.restaurant_id = $2
       ORDER BY o.created_at`,
      [table.session_id, restaurantId],
    );
    const byOrder = new Map<string, OrderItemView[]>();
    for (const row of itemRows) {
      const list = byOrder.get(row.order_id) ?? [];
      list.push(mapItem(row));
      byOrder.set(row.order_id, list);
    }
    orders = orderRows.map((row) => mapOrder(row, byOrder.get(row.id) ?? []));
  }

  const categories: ComposerCategory[] = [];
  const categoryIndex = new Map<string, ComposerCategory>();
  for (const row of menuRows) {
    let category = categoryIndex.get(row.category_id);
    if (!category) {
      category = { id: row.category_id, name: row.category_name, items: [] };
      categoryIndex.set(row.category_id, category);
      categories.push(category);
    }
    if (!row.item_id) continue;
    category.items.push({
      id: row.item_id,
      name: row.name,
      description: row.description,
      priceCents: row.price_cents,
      prepMinutes: row.prep_minutes,
      stationId: row.station_id,
      stationName: row.station_name,
      allergens: row.allergens,
      isAvailable: row.is_available,
    });
  }

  return {
    table: {
      id: table.id,
      label: table.label,
      zone: table.zone,
      seats: table.seats,
      qrToken: table.qr_token,
    },
    session: table.session_id
      ? { id: table.session_id, openedAt: table.opened_at?.toISOString() ?? "" }
      : null,
    orders,
    totalCents: orders.reduce((sum, order) => sum + order.totalCents, 0),
    bill: billRows[0]
      ? {
          id: billRows[0].id,
          status: billRows[0].status,
          requestedAt: billRows[0].requested_at.toISOString(),
          note: billRows[0].note,
        }
      : null,
    categories,
    stations: stationRows.map((row) => ({
      id: row.id,
      name: row.name,
      capacity: row.capacity,
      sortOrder: row.sort_order,
    })),
  };
}

export interface BillRowView extends ActiveBill {
  completedAt: string | null;
}

export async function getBills(
  userId: string,
  restaurantId: string,
): Promise<{ active: ActiveBill[]; recent: BillRowView[] }> {
  const rows = await userQuery<{
    id: string;
    status: "requested" | "attending" | "completed" | "cancelled";
    requested_at: Date;
    attended_at: Date | null;
    completed_at: Date | null;
    note: string | null;
    table_id: string;
    table_label: string;
    zone: string | null;
    session_id: string;
    orders: number;
    total_cents: number;
  }>(
    userId,
    `SELECT b.id, b.status, b.requested_at, b.attended_at, b.completed_at, b.note,
            t.id AS table_id, t.label AS table_label, t.zone,
            b.service_session_id AS session_id,
            (SELECT count(*)::int FROM orders o
              WHERE o.service_session_id = b.service_session_id AND o.status = 'open') AS orders,
            (SELECT COALESCE(sum(oi.quantity * oi.unit_price_cents), 0)::int
              FROM order_items oi JOIN orders o ON o.id = oi.order_id
              WHERE o.service_session_id = b.service_session_id
                AND o.status = 'open' AND oi.status <> 'cancelled') AS total_cents
     FROM bill_requests b
     JOIN dining_tables t ON t.id = b.table_id
     WHERE b.restaurant_id = $1
       AND b.requested_at > now() - interval '2 days'
     ORDER BY b.requested_at DESC
     LIMIT 80`,
    [restaurantId],
  );

  const mapped: BillRowView[] = rows.map((row) => ({
    id: row.id,
    status: row.status,
    requestedAt: row.requested_at.toISOString(),
    attendedAt: row.attended_at?.toISOString() ?? null,
    completedAt: row.completed_at?.toISOString() ?? null,
    note: row.note,
    tableId: row.table_id,
    tableLabel: row.table_label,
    zone: row.zone,
    sessionId: row.session_id,
    orders: row.orders,
    totalCents: row.total_cents,
  }));

  return {
    active: mapped.filter((bill) => bill.status === "requested" || bill.status === "attending"),
    recent: mapped.filter((bill) => bill.status !== "requested" && bill.status !== "attending"),
  };
}

export interface DashboardData {
  counts: {
    openTables: number;
    activeOrders: number;
    pendingItems: number;
    readyItems: number;
    billRequests: number;
    menuItems: number;
    tables: number;
    staff: number;
    averagePrepMinutes: number;
  };
  recentOrders: {
    id: string;
    tableId: string;
    number: number;
    tableLabel: string;
    createdAt: string;
    status: string;
    items: number;
    totalCents: number;
  }[];
  medians: {
    dish: string;
    station: string;
    medianMinutes: number;
    samples: number;
  }[];
  recentAudit: {
    id: string;
    action: string;
    entity: string;
    actorLabel: string;
    createdAt: string;
  }[];
}

export async function getDashboard(
  userId: string,
  restaurantId: string,
): Promise<DashboardData> {
  const [countRows, recentRows, medianRows, auditRows] = await Promise.all([
    userQuery<Record<string, string | number | null>>(
      userId,
      `SELECT
         (SELECT count(*)::int FROM service_sessions WHERE restaurant_id = $1 AND status = 'open') AS open_tables,
         (SELECT count(*)::int FROM orders WHERE restaurant_id = $1 AND status = 'open') AS active_orders,
         (SELECT count(*)::int FROM order_items oi JOIN orders o ON o.id = oi.order_id
           WHERE o.restaurant_id = $1 AND o.status = 'open'
             AND oi.status IN ('queued', 'preparing', 'incident')) AS pending_items,
         (SELECT count(*)::int FROM order_items oi JOIN orders o ON o.id = oi.order_id
           WHERE o.restaurant_id = $1 AND o.status = 'open' AND oi.status = 'ready') AS ready_items,
         (SELECT count(*)::int FROM bill_requests WHERE restaurant_id = $1 AND status IN ('requested', 'attending')) AS bill_requests,
         (SELECT count(*)::int FROM menu_items WHERE restaurant_id = $1 AND is_published) AS menu_items,
         (SELECT count(*)::int FROM dining_tables WHERE restaurant_id = $1 AND is_active) AS tables,
         (SELECT count(*)::int FROM restaurant_members WHERE restaurant_id = $1) AS staff,
         (SELECT COALESCE(round(avg(extract(epoch from (oi.ready_at - oi.started_at)) / 60)), 0)::int
           FROM order_items oi JOIN orders o ON o.id = oi.order_id
           WHERE o.restaurant_id = $1 AND oi.started_at IS NOT NULL
             AND oi.ready_at > now() - interval '7 days') AS average_prep`,
      [restaurantId],
    ),
    userQuery<{
      id: string;
      table_id: string;
      order_number: number;
      table_label: string;
      created_at: Date;
      status: string;
      items: number;
      total_cents: number;
    }>(
      userId,
      `SELECT o.id, o.table_id, o.order_number, t.label AS table_label, o.created_at, o.status,
              count(oi.id)::int AS items,
              COALESCE(sum(oi.quantity * oi.unit_price_cents) FILTER (WHERE oi.status <> 'cancelled'), 0)::int AS total_cents
       FROM orders o
       JOIN dining_tables t ON t.id = o.table_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.restaurant_id = $1
       GROUP BY o.id, o.table_id, t.label
       ORDER BY o.created_at DESC
       LIMIT 8`,
      [restaurantId],
    ),
    userQuery<{
      dish: string;
      station: string;
      median_minutes: number;
      samples: number;
    }>(
      userId,
      `SELECT oi.name_snapshot AS dish, ks.name AS station,
              round(percentile_cont(0.5) WITHIN GROUP (
                ORDER BY extract(epoch from (COALESCE(oi.ready_at, oi.delivered_at) - oi.started_at)) / 60
              ))::int AS median_minutes,
              count(*)::int AS samples
       FROM order_items oi
       JOIN kitchen_stations ks ON ks.id = oi.station_id
       WHERE oi.restaurant_id = $1
         AND oi.started_at IS NOT NULL
         AND COALESCE(oi.ready_at, oi.delivered_at) > now() - interval '30 days'
       GROUP BY oi.name_snapshot, ks.name
       HAVING count(*) >= 3
       ORDER BY median_minutes DESC, samples DESC
       LIMIT 8`,
      [restaurantId],
    ),
    userQuery<{
      id: string;
      action: string;
      entity: string;
      actor_label: string;
      created_at: Date;
    }>(
      userId,
      `SELECT id, action, entity, actor_label, created_at FROM audit_logs
       WHERE restaurant_id = $1 ORDER BY created_at DESC LIMIT 6`,
      [restaurantId],
    ),
  ]);

  const counts = countRows[0] ?? {};
  const number = (key: string) => Number(counts[key] ?? 0);

  return {
    counts: {
      openTables: number("open_tables"),
      activeOrders: number("active_orders"),
      pendingItems: number("pending_items"),
      readyItems: number("ready_items"),
      billRequests: number("bill_requests"),
      menuItems: number("menu_items"),
      tables: number("tables"),
      staff: number("staff"),
      averagePrepMinutes: number("average_prep"),
    },
    recentOrders: recentRows.map((row) => ({
      id: row.id,
      tableId: row.table_id,
      number: row.order_number,
      tableLabel: row.table_label,
      createdAt: row.created_at.toISOString(),
      status: row.status,
      items: row.items,
      totalCents: row.total_cents,
    })),
    medians: medianRows.map((row) => ({
      dish: row.dish,
      station: row.station,
      medianMinutes: row.median_minutes,
      samples: row.samples,
    })),
    recentAudit: auditRows.map((row) => ({
      id: row.id,
      action: row.action,
      entity: row.entity,
      actorLabel: row.actor_label,
      createdAt: row.created_at.toISOString(),
    })),
  };
}

export interface HistoryEntry {
  id: string;
  tableLabel: string;
  openedAt: string;
  closedAt: string | null;
  orders: number;
  items: number;
  totalCents: number;
}

export async function getServiceHistory(
  userId: string,
  restaurantId: string,
  limit = 50,
): Promise<HistoryEntry[]> {
  const rows = await userQuery<{
    id: string;
    table_label: string;
    opened_at: Date;
    closed_at: Date | null;
    orders: number;
    items: number;
    total_cents: number;
  }>(
    userId,
    `SELECT ss.id, t.label AS table_label, ss.opened_at, ss.closed_at,
            count(DISTINCT o.id)::int AS orders,
            COALESCE(sum(oi.quantity), 0)::int AS items,
            COALESCE(sum(oi.quantity * oi.unit_price_cents) FILTER (WHERE oi.status <> 'cancelled'), 0)::int AS total_cents
     FROM service_sessions ss
     JOIN dining_tables t ON t.id = ss.table_id
     LEFT JOIN orders o ON o.service_session_id = ss.id
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE ss.restaurant_id = $1 AND ss.status = 'closed'
     GROUP BY ss.id, t.label
     ORDER BY ss.closed_at DESC NULLS LAST
     LIMIT $2`,
    [restaurantId, limit],
  );

  return rows.map((row) => ({
    id: row.id,
    tableLabel: row.table_label,
    openedAt: row.opened_at.toISOString(),
    closedAt: row.closed_at?.toISOString() ?? null,
    orders: row.orders,
    items: row.items,
    totalCents: row.total_cents,
  }));
}

export interface StatsData {
  summary: {
    orders: number;
    dishes: number;
    revenueCents: number;
    averageTicketCents: number;
    averagePrepMinutes: number;
  };
  daily: { date: string; orders: number; dishes: number; revenueCents: number }[];
  stations: { station: string; dishes: number; medianMinutes: number; samples: number }[];
  hours: { hour: number; orders: number }[];
}

export async function getStats(userId: string, restaurantId: string): Promise<StatsData> {
  const [summaryRows, dailyRows, stationRows, hourRows] = await Promise.all([
    userQuery<Record<string, string | null>>(
      userId,
      `SELECT
         (SELECT count(*)::int FROM orders WHERE restaurant_id = $1 AND created_at > now() - interval '30 days') AS orders,
         (SELECT count(*)::int FROM order_items oi JOIN orders o ON o.id = oi.order_id
           WHERE oi.restaurant_id = $1 AND o.created_at > now() - interval '30 days'
             AND oi.status <> 'cancelled') AS dishes,
         (SELECT COALESCE(sum(oi.quantity * oi.unit_price_cents), 0)::int
           FROM order_items oi JOIN orders o ON o.id = oi.order_id
           WHERE oi.restaurant_id = $1 AND o.created_at > now() - interval '30 days'
             AND oi.status <> 'cancelled') AS revenue,
         (SELECT COALESCE(round(avg(ticket)), 0)::int FROM (
            SELECT sum(oi.quantity * oi.unit_price_cents) AS ticket
            FROM orders o JOIN order_items oi ON oi.order_id = o.id
            WHERE o.restaurant_id = $1 AND o.created_at > now() - interval '30 days'
              AND oi.status <> 'cancelled'
            GROUP BY o.id
          ) tickets) AS average_ticket,
         (SELECT COALESCE(round(avg(extract(epoch from (oi.ready_at - oi.started_at)) / 60)), 0)::int
           FROM order_items oi JOIN orders o ON o.id = oi.order_id
           WHERE oi.restaurant_id = $1 AND oi.started_at IS NOT NULL
             AND oi.ready_at > now() - interval '30 days') AS average_prep`,
      [restaurantId],
    ),
    userQuery<{ date: string; orders: number; dishes: number; revenue_cents: number }>(
      userId,
      `WITH days AS (
         SELECT generate_series(current_date - 13, current_date, interval '1 day')::date AS day
       )
       SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
              count(DISTINCT o.id)::int AS orders,
              COALESCE(sum(oi.quantity), 0)::int AS dishes,
              COALESCE(sum(oi.quantity * oi.unit_price_cents) FILTER (WHERE oi.status <> 'cancelled'), 0)::int AS revenue_cents
       FROM days d
       LEFT JOIN orders o ON o.restaurant_id = $1 AND o.created_at::date = d.day
       LEFT JOIN order_items oi ON oi.order_id = o.id
       GROUP BY d.day ORDER BY d.day`,
      [restaurantId],
    ),
    userQuery<{ station: string; dishes: number; median_minutes: number; samples: number }>(
      userId,
      `SELECT ks.name AS station,
              count(*)::int AS dishes,
              COALESCE(round(percentile_cont(0.5) WITHIN GROUP (
                ORDER BY extract(epoch from (COALESCE(oi.ready_at, oi.delivered_at) - oi.started_at)) / 60
              )), 0)::int AS median_minutes,
              count(*) FILTER (WHERE oi.started_at IS NOT NULL)::int AS samples
       FROM order_items oi
       JOIN kitchen_stations ks ON ks.id = oi.station_id
       WHERE oi.restaurant_id = $1 AND oi.queued_at > now() - interval '30 days'
         AND oi.status <> 'cancelled'
       GROUP BY ks.name ORDER BY dishes DESC`,
      [restaurantId],
    ),
    userQuery<{ hour: number; orders: number }>(
      userId,
      `SELECT extract(hour from created_at)::int AS hour, count(*)::int AS orders
       FROM orders WHERE restaurant_id = $1 AND created_at > now() - interval '30 days'
       GROUP BY hour ORDER BY hour`,
      [restaurantId],
    ),
  ]);

  const summary = summaryRows[0] ?? {};
  const n = (key: string) => Number(summary[key] ?? 0);

  return {
    summary: {
      orders: n("orders"),
      dishes: n("dishes"),
      revenueCents: n("revenue"),
      averageTicketCents: n("average_ticket"),
      averagePrepMinutes: n("average_prep"),
    },
    daily: dailyRows.map((row) => ({
      date: row.date,
      orders: row.orders,
      dishes: row.dishes,
      revenueCents: row.revenue_cents,
    })),
    stations: stationRows.map((row) => ({
      station: row.station,
      dishes: row.dishes,
      medianMinutes: row.median_minutes,
      samples: row.samples,
    })),
    hours: hourRows.map((row) => ({ hour: row.hour, orders: row.orders })),
  };
}

export async function getRecentAudit(
  userId: string,
  restaurantId: string,
  limit = 100,
): Promise<
  {
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    actorLabel: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }[]
> {
  const rows = await userQuery<{
    id: string;
    action: string;
    entity: string;
    entity_id: string | null;
    actor_label: string;
    metadata: Record<string, unknown>;
    created_at: Date;
  }>(
    userId,
    `SELECT id, action, entity, entity_id, actor_label, metadata, created_at
     FROM audit_logs WHERE restaurant_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [restaurantId, limit],
  );
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    actorLabel: row.actor_label,
    metadata: row.metadata,
    createdAt: row.created_at.toISOString(),
  }));
}
