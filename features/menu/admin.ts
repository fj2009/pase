import "server-only";

import { userQuery } from "@/lib/db";

export interface AdminMenuItem {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string | null;
  ingredients: string | null;
  allergens: string[];
  priceCents: number;
  imageUrl: string | null;
  prepMinutes: number;
  isAvailable: boolean;
  isPublished: boolean;
  sortOrder: number;
  stationId: string;
  stationName: string;
}

export interface AdminCategory {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isVisible: boolean;
  items: AdminMenuItem[];
}

interface ItemRow {
  id: string;
  category_id: string;
  category_name: string;
  name: string;
  description: string | null;
  ingredients: string | null;
  allergens: string[];
  price_cents: number;
  image_url: string | null;
  prep_minutes: number;
  is_available: boolean;
  is_published: boolean;
  sort_order: number;
  station_id: string;
  station_name: string;
}

function mapItem(row: ItemRow): AdminMenuItem {
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    name: row.name,
    description: row.description,
    ingredients: row.ingredients,
    allergens: row.allergens,
    priceCents: row.price_cents,
    imageUrl: row.image_url,
    prepMinutes: row.prep_minutes,
    isAvailable: row.is_available,
    isPublished: row.is_published,
    sortOrder: row.sort_order,
    stationId: row.station_id,
    stationName: row.station_name,
  };
}

export async function getMenuAdmin(
  userId: string,
  restaurantId: string,
): Promise<{ categories: AdminCategory[]; stations: { id: string; name: string }[] }> {
  const [categoryRows, itemRows, stationRows] = await Promise.all([
    userQuery<{
      id: string;
      name: string;
      description: string | null;
      sort_order: number;
      is_visible: boolean;
    }>(
      userId,
      `SELECT id, name, description, sort_order, is_visible FROM menu_categories
       WHERE restaurant_id = $1 ORDER BY sort_order, name`,
      [restaurantId],
    ),
    userQuery<ItemRow>(
      userId,
      `SELECT mi.id, mi.category_id, c.name AS category_name, mi.name, mi.description,
              mi.ingredients, mi.allergens, mi.price_cents, mi.image_url, mi.prep_minutes,
              mi.is_available, mi.is_published, mi.sort_order, mi.station_id, ks.name AS station_name
       FROM menu_items mi
       JOIN menu_categories c ON c.id = mi.category_id
       JOIN kitchen_stations ks ON ks.id = mi.station_id
       WHERE mi.restaurant_id = $1
       ORDER BY c.sort_order, c.name, mi.sort_order, mi.name`,
      [restaurantId],
    ),
    userQuery<{ id: string; name: string }>(
      userId,
      `SELECT id, name FROM kitchen_stations
       WHERE restaurant_id = $1 AND is_active ORDER BY sort_order, name`,
      [restaurantId],
    ),
  ]);

  const byCategory = new Map<string, AdminMenuItem[]>();
  for (const row of itemRows) {
    const list = byCategory.get(row.category_id) ?? [];
    list.push(mapItem(row));
    byCategory.set(row.category_id, list);
  }

  return {
    categories: categoryRows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      sortOrder: row.sort_order,
      isVisible: row.is_visible,
      items: byCategory.get(row.id) ?? [],
    })),
    stations: stationRows,
  };
}

export async function getAdminMenuItem(
  userId: string,
  restaurantId: string,
  itemId: string,
): Promise<AdminMenuItem | null> {
  const rows = await userQuery<ItemRow>(
    userId,
    `SELECT mi.id, mi.category_id, c.name AS category_name, mi.name, mi.description,
            mi.ingredients, mi.allergens, mi.price_cents, mi.image_url, mi.prep_minutes,
            mi.is_available, mi.is_published, mi.sort_order, mi.station_id, ks.name AS station_name
     FROM menu_items mi
     JOIN menu_categories c ON c.id = mi.category_id
     JOIN kitchen_stations ks ON ks.id = mi.station_id
     WHERE mi.id = $1 AND mi.restaurant_id = $2`,
    [itemId, restaurantId],
  );
  return rows[0] ? mapItem(rows[0]) : null;
}

export async function getAdminCategory(
  userId: string,
  restaurantId: string,
  categoryId: string,
): Promise<{
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isVisible: boolean;
  itemCount: number;
} | null> {
  const rows = await userQuery<{
    id: string;
    name: string;
    description: string | null;
    sort_order: number;
    is_visible: boolean;
    item_count: number;
  }>(
    userId,
    `SELECT c.id, c.name, c.description, c.sort_order, c.is_visible,
            (SELECT count(*)::int FROM menu_items mi WHERE mi.category_id = c.id) AS item_count
     FROM menu_categories c
     WHERE c.id = $1 AND c.restaurant_id = $2`,
    [categoryId, restaurantId],
  );
  const row = rows[0];
  return row
    ? {
        id: row.id,
        name: row.name,
        description: row.description,
        sortOrder: row.sort_order,
        isVisible: row.is_visible,
        itemCount: row.item_count,
      }
    : null;
}
