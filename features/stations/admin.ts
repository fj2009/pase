import "server-only";

import { userQuery } from "@/lib/db";

export interface AdminStation {
  id: string;
  name: string;
  capacity: number;
  sortOrder: number;
  isActive: boolean;
  itemCount: number;
  printerCount: number;
}

export async function getStationsAdmin(
  userId: string,
  restaurantId: string,
): Promise<AdminStation[]> {
  const rows = await userQuery<{
    id: string;
    name: string;
    capacity: number;
    sort_order: number;
    is_active: boolean;
    item_count: number;
    printer_count: number;
  }>(
    userId,
    `SELECT ks.id, ks.name, ks.capacity, ks.sort_order, ks.is_active,
            (SELECT count(*)::int FROM menu_items mi WHERE mi.station_id = ks.id) AS item_count,
            (SELECT count(*)::int FROM printer_stations ps WHERE ps.station_id = ks.id) AS printer_count
     FROM kitchen_stations ks
     WHERE ks.restaurant_id = $1
     ORDER BY ks.sort_order, ks.name`,
    [restaurantId],
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    capacity: row.capacity,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    itemCount: row.item_count,
    printerCount: row.printer_count,
  }));
}
