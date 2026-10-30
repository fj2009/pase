import "server-only";

import { userQuery } from "@/lib/db";

export interface AdminTable {
  id: string;
  label: string;
  zone: string | null;
  seats: number;
  qrToken: string;
  isActive: boolean;
  sessionId: string | null;
  sessionOpenedAt: string | null;
  activeOrders: number;
}

interface TableRow {
  id: string;
  label: string;
  zone: string | null;
  seats: number;
  qr_token: string;
  is_active: boolean;
  session_id: string | null;
  session_opened_at: string | null;
  active_orders: number;
}

function mapTable(row: TableRow): AdminTable {
  return {
    id: row.id,
    label: row.label,
    zone: row.zone,
    seats: row.seats,
    qrToken: row.qr_token,
    isActive: row.is_active,
    sessionId: row.session_id,
    sessionOpenedAt: row.session_opened_at,
    activeOrders: row.active_orders,
  };
}

const SELECT = `
  SELECT t.id, t.label, t.zone, t.seats, t.qr_token, t.is_active,
         s.id AS session_id, s.opened_at AS session_opened_at,
         COALESCE((
           SELECT count(*)::int FROM orders o
           WHERE o.service_session_id = s.id AND o.status = 'open'
         ), 0) AS active_orders
  FROM dining_tables t
  LEFT JOIN LATERAL (
    SELECT ss.id, ss.opened_at FROM service_sessions ss
    WHERE ss.table_id = t.id AND ss.status = 'open'
    ORDER BY ss.opened_at DESC LIMIT 1
  ) s ON true
`;

export async function getTablesAdmin(
  userId: string,
  restaurantId: string,
): Promise<AdminTable[]> {
  const rows = await userQuery<TableRow>(
    userId,
    `${SELECT} WHERE t.restaurant_id = $1 ORDER BY COALESCE(t.zone, ''), t.label`,
    [restaurantId],
  );
  return rows.map(mapTable);
}

export async function getTableAdmin(
  userId: string,
  restaurantId: string,
  tableId: string,
): Promise<AdminTable | null> {
  const rows = await userQuery<TableRow>(
    userId,
    `${SELECT} WHERE t.restaurant_id = $1 AND t.id = $2`,
    [restaurantId, tableId],
  );
  return rows[0] ? mapTable(rows[0]) : null;
}
