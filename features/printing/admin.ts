import "server-only";

import { userQuery } from "@/lib/db";

export type PrinterKind = "test" | "network" | "usb_agent";

export interface AdminPrinter {
  id: string;
  name: string;
  kind: PrinterKind;
  target: string | null;
  paperWidth: number;
  isActive: boolean;
  stations: { id: string; name: string }[];
  pendingJobs: number;
}

export async function getPrintersAdmin(
  userId: string,
  restaurantId: string,
): Promise<AdminPrinter[]> {
  const [printerRows, linkRows] = await Promise.all([
    userQuery<{
      id: string;
      name: string;
      kind: PrinterKind;
      target: string | null;
      paper_width: number;
      is_active: boolean;
      pending_jobs: number;
    }>(
      userId,
      `SELECT p.id, p.name, p.kind, p.target, p.paper_width, p.is_active,
              (SELECT count(*)::int FROM print_jobs pj
               WHERE pj.printer_id = p.id AND pj.status IN ('pending', 'processing')) AS pending_jobs
       FROM printers p
       WHERE p.restaurant_id = $1
       ORDER BY p.name`,
      [restaurantId],
    ),
    userQuery<{ printer_id: string; station_id: string; station_name: string }>(
      userId,
      `SELECT ps.printer_id, ps.station_id, ks.name AS station_name
       FROM printer_stations ps
       JOIN kitchen_stations ks ON ks.id = ps.station_id
       WHERE ps.restaurant_id = $1
       ORDER BY ks.sort_order, ks.name`,
      [restaurantId],
    ),
  ]);

  const stationsByPrinter = new Map<string, { id: string; name: string }[]>();
  for (const row of linkRows) {
    const list = stationsByPrinter.get(row.printer_id) ?? [];
    list.push({ id: row.station_id, name: row.station_name });
    stationsByPrinter.set(row.printer_id, list);
  }

  return printerRows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    target: row.target,
    paperWidth: row.paper_width,
    isActive: row.is_active,
    stations: stationsByPrinter.get(row.id) ?? [],
    pendingJobs: row.pending_jobs,
  }));
}

export interface AdminPrintAgent {
  id: string;
  name: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export async function getPrintAgents(
  userId: string,
  restaurantId: string,
): Promise<AdminPrintAgent[]> {
  const rows = await userQuery<{
    id: string;
    name: string;
    last_seen_at: Date | null;
    revoked_at: Date | null;
    created_at: Date;
  }>(
    userId,
    `SELECT id, name, last_seen_at, revoked_at, created_at
     FROM print_agents WHERE restaurant_id = $1 ORDER BY created_at DESC`,
    [restaurantId],
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    lastSeenAt: row.last_seen_at?.toISOString() ?? null,
    revokedAt: row.revoked_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  }));
}

export interface AdminPrintJob {
  id: string;
  printerName: string;
  status: "pending" | "processing" | "printed" | "failed";
  attempts: number;
  lastError: string | null;
  createdAt: string;
  printedAt: string | null;
  orderNumber: number | null;
  tableLabel: string | null;
  itemCount: number;
  jobType: string;
}

export async function getPrintJobs(
  userId: string,
  restaurantId: string,
  limit = 40,
): Promise<AdminPrintJob[]> {
  const rows = await userQuery<{
    id: string;
    printer_name: string;
    status: AdminPrintJob["status"];
    attempts: number;
    last_error: string | null;
    created_at: Date;
    printed_at: Date | null;
    order_number: number | null;
    table_label: string | null;
    item_count: number;
    job_type: string | null;
  }>(
    userId,
    `SELECT pj.id, p.name AS printer_name, pj.status, pj.attempts, pj.last_error,
            pj.created_at, pj.printed_at, o.order_number, t.label AS table_label,
            COALESCE(jsonb_array_length(pj.payload->'items'), 0) AS item_count,
            pj.payload->>'type' AS job_type
     FROM print_jobs pj
     JOIN printers p ON p.id = pj.printer_id
     LEFT JOIN orders o ON o.id = pj.order_id
     LEFT JOIN service_sessions ss ON ss.id = o.service_session_id
     LEFT JOIN dining_tables t ON t.id = ss.table_id
     WHERE pj.restaurant_id = $1
     ORDER BY pj.created_at DESC
     LIMIT $2`,
    [restaurantId, limit],
  );

  return rows.map((row) => ({
    id: row.id,
    printerName: row.printer_name,
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error,
    createdAt: row.created_at.toISOString(),
    printedAt: row.printed_at?.toISOString() ?? null,
    orderNumber: row.order_number,
    tableLabel: row.table_label,
    itemCount: row.item_count,
    jobType: row.job_type ?? "order",
  }));
}
