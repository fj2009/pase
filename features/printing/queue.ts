import "server-only";

import type { PoolClient } from "pg";

export interface TicketItem {
  name: string;
  quantity: number;
  notes: string | null;
  allergens: string[];
  stationId: string;
  stationName: string;
}

export interface TicketOrder {
  id: string;
  number: number;
  tableLabel: string;
  createdAt: Date;
  notes: string | null;
}

export interface TicketRestaurant {
  id: string;
  name: string;
}

interface PrinterRow {
  id: string;
  name: string;
  paper_width: number;
  station_id: string;
}

export async function enqueueTickets(
  client: PoolClient,
  options: {
    restaurant: TicketRestaurant;
    order: TicketOrder;
    items: TicketItem[];
    itemIds: string[];
    stationIds: string[];
    batchKey: string;
    createdBy: string;
    mode?: "order" | "reprint" | "test";
    reprintOf?: Record<string, string>;
  },
): Promise<number> {
  const { restaurant, order, items, stationIds, batchKey, createdBy } = options;
  if (stationIds.length === 0 || items.length === 0) return 0;

  const printers = await client.query<PrinterRow>(
    `SELECT p.id, p.name, p.paper_width, ps.station_id
     FROM printer_stations ps
     JOIN printers p ON p.id = ps.printer_id
     WHERE ps.restaurant_id = $1
       AND ps.station_id = ANY($2::uuid[])
       AND p.is_active`,
    [restaurant.id, stationIds],
  );

  const byPrinter = new Map<string, PrinterRow[]>();
  for (const row of printers.rows) {
    const list = byPrinter.get(row.id) ?? [];
    list.push(row);
    byPrinter.set(row.id, list);
  }

  let created = 0;
  for (const [printerId, rows] of byPrinter) {
    const printer = rows[0];
    if (!printer) continue;
    const coveredStations = new Set(rows.map((row) => row.station_id));
    const printerItems = items.filter((item) => coveredStations.has(item.stationId));
    if (printerItems.length === 0) continue;

    const payload = {
      type: options.mode ?? "order",
      restaurant: { name: restaurant.name },
      order: {
        id: order.id,
        number: order.number,
        table: order.tableLabel,
        created_at: order.createdAt.toISOString(),
        notes: order.notes,
      },
      printer: {
        id: printer.id,
        name: printer.name,
        paper_width: printer.paper_width,
      },
      items: printerItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        notes: item.notes,
        allergens: item.allergens,
        station: item.stationName,
      })),
      generated_at: new Date().toISOString(),
    };

    const result = await client.query(
      `INSERT INTO print_jobs
        (restaurant_id, printer_id, order_id, order_item_ids, payload, idempotency_key, created_by, reprint_of)
       VALUES ($1, $2, $3, $4::uuid[], $5::jsonb, $6, $7, $8)
       ON CONFLICT (restaurant_id, idempotency_key) DO NOTHING`,
      [
        restaurant.id,
        printerId,
        order.id,
        options.itemIds,
        JSON.stringify(payload),
        `ticket:${printerId}:${batchKey}`,
        createdBy,
        options.reprintOf?.[printerId] ?? null,
      ],
    );
    created += result.rowCount ?? 0;
  }

  return created;
}
