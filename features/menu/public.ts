import "server-only";

import { publicQuery } from "@/lib/db";

export interface PublicMenuItem {
  id: string;
  name: string;
  description: string | null;
  ingredients: string | null;
  allergens: string[];
  price_cents: number;
  image_url: string | null;
  prep_minutes: number;
  is_available: boolean;
  sort_order: number;
}

export interface PublicCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  items: PublicMenuItem[];
}

export interface PublicOrderSummary {
  id: string;
  order_number: number;
  status: "open" | "closed" | "cancelled";
  created_at: string;
  tracking_token: string;
  tracking_expires_at: string;
  items_count: number;
  ready_count: number;
  total_cents: number;
}

export interface PublicMenuPayload {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    accent: "olive" | "terracotta";
    timezone: string;
    address: string | null;
    phone: string | null;
  };
  categories: PublicCategory[];
  table: { label: string; zone: string | null } | null;
  session: { opened_at: string } | null;
  orders: PublicOrderSummary[];
  bill_request: { status: string; requested_at: string } | null;
  service_open: boolean;
}

export async function getPublicMenu(
  slug: string,
  tableToken?: string,
): Promise<PublicMenuPayload | null> {
  const rows = await publicQuery<{ menu: PublicMenuPayload | null }>(
    "SELECT api.menu($1, $2) AS menu",
    [slug, tableToken ?? null],
  );
  return rows[0]?.menu ?? null;
}
