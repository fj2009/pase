import "server-only";

import { userQuery } from "@/lib/db";

export interface PlatformRestaurant {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  timezone: string;
  accent: "olive" | "terracotta";
  isActive: boolean;
  createdAt: string;
  members: number;
  tables: number;
  orders30: number;
  revenue30Cents: number;
  plan: string | null;
  subscriptionStatus: string | null;
  periodEnd: string | null;
}

export async function getPlatformRestaurants(userId: string): Promise<PlatformRestaurant[]> {
  const rows = await userQuery<{
    id: string;
    name: string;
    slug: string;
    address: string | null;
    timezone: string;
    accent: "olive" | "terracotta";
    is_active: boolean;
    created_at: Date;
    members: number;
    tables: number;
    orders30: number;
    revenue30_cents: number;
    plan: string | null;
    subscription_status: string | null;
    period_end: Date | null;
  }>(
    userId,
    `SELECT r.id, r.name, r.slug, r.address, r.timezone, r.accent, r.is_active, r.created_at,
            (SELECT count(*)::int FROM restaurant_members m WHERE m.restaurant_id = r.id) AS members,
            (SELECT count(*)::int FROM dining_tables t WHERE t.restaurant_id = r.id) AS tables,
            (SELECT count(*)::int FROM orders o
             WHERE o.restaurant_id = r.id AND o.created_at > now() - interval '30 days') AS orders30,
            (SELECT COALESCE(sum(oi.quantity * oi.unit_price_cents), 0)::int
             FROM order_items oi JOIN orders o ON o.id = oi.order_id
             WHERE oi.restaurant_id = r.id AND o.created_at > now() - interval '30 days'
               AND oi.status <> 'cancelled') AS revenue30_cents,
            s.plan, s.status::text AS subscription_status, s.current_period_end AS period_end
     FROM restaurants r
     LEFT JOIN subscriptions s ON s.restaurant_id = r.id
     ORDER BY r.is_active DESC, r.created_at DESC`,
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    address: row.address,
    timezone: row.timezone,
    accent: row.accent,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    members: row.members,
    tables: row.tables,
    orders30: row.orders30,
    revenue30Cents: row.revenue30_cents,
    plan: row.plan,
    subscriptionStatus: row.subscription_status,
    periodEnd: row.period_end?.toISOString() ?? null,
  }));
}
