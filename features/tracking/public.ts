import { publicQuery } from "@/lib/db";
import type { ItemStatus } from "@/features/orders/state-machine";

export interface TrackingItem {
  id: string;
  name: string;
  quantity: number;
  status: ItemStatus;
  prep_minutes: number;
  queued_at: string;
  started_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  station_id: string;
}

export interface TrackingBacklog {
  capacity: number;
  active_items: number;
  remaining_minutes: number;
}

export interface TrackingPayload {
  order: {
    number: number;
    status: "open" | "closed";
    created_at: string;
    closed_at: string | null;
    expires_at: string;
    expired: boolean;
    total_cents: number;
  };
  restaurant: { name: string; slug: string; timezone: string };
  table: { label: string; zone: string | null };
  items: TrackingItem[];
  station_backlog: Record<string, TrackingBacklog>;
  generated_at: string;
}

export async function getTracking(token: string): Promise<TrackingPayload | null> {
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(token)) return null;
  const rows = await publicQuery<{ tracking: TrackingPayload | null }>(
    "SELECT api.tracking($1) AS tracking",
    [token],
  );
  return rows[0]?.tracking ?? null;
}
