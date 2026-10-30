"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCapability } from "@/features/auth/session";
import { audit, safeReturnTo } from "@/features/audit/log";
import { isAllergenKey } from "@/features/menu/allergens";
import { withDb } from "@/lib/db";
import { AppError, isAppError } from "@/lib/errors";
import { parsePriceToCents } from "@/lib/money";

const uuid = z.string().uuid();

function flash(path: string, key: string, value: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${value}`;
}

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(80),
  description: z.string().trim().max(300).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999),
  isVisible: z.boolean(),
});

export async function saveCategoryAction(formData: FormData): Promise<void> {
  const returnTo = safeReturnTo(
    formData.get("returnTo"),
    formData.get("id") ? `/admin/carta/categoria/${formData.get("id")}` : "/admin/carta/categoria/nueva",
  );
  const parsed = categorySchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    sortOrder: formData.get("sortOrder") || 0,
    isVisible: formData.get("isVisible") === "on",
  });
  if (!parsed.success) redirect(flash(returnTo, "error", "datos"));

  const context = await requireCapability("manageMenu");
  const restaurantId = context.restaurant.restaurantId;

  try {
    await withDb(context.user.id, async (client) => {
      if (parsed.data.id) {
        const updated = await client.query(
          `UPDATE menu_categories
           SET name = $3, description = $4, sort_order = $5, is_visible = $6
           WHERE id = $1 AND restaurant_id = $2
           RETURNING id`,
          [
            parsed.data.id,
            restaurantId,
            parsed.data.name,
            parsed.data.description || null,
            parsed.data.sortOrder,
            parsed.data.isVisible,
          ],
        );
        if (updated.rowCount === 0) {
          throw new AppError("La categoría ya no existe.", "not_found", 404);
        }
      } else {
        const inserted = await client.query(
          `INSERT INTO menu_categories (restaurant_id, name, description, sort_order, is_visible)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [
            restaurantId,
            parsed.data.name,
            parsed.data.description || null,
            parsed.data.sortOrder,
            parsed.data.isVisible,
          ],
        );
        await audit(client, {
          restaurantId,
          actorId: context.user.id,
          actorLabel: context.user.fullName,
          action: "menu.category_created",
          entity: "menu_category",
          entityId: inserted.rows[0]?.id ?? null,
          metadata: { name: parsed.data.name },
        });
        return;
      }

      await audit(client, {
        restaurantId,
        actorId: context.user.id,
        actorLabel: context.user.fullName,
        action: "menu.category_updated",
        entity: "menu_category",
        entityId: parsed.data.id,
        metadata: { name: parsed.data.name },
      });
    });
  } catch (error) {
    redirect(
      flash(returnTo, "error", isAppError(error) && error.code === "not_found" ? "datos" : "datos"),
    );
  }

  revalidatePath("/admin/carta");
  revalidatePath(`/carta/${context.restaurant.slug}`);
  redirect("/admin/carta?ok=categoria_guardada");
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const parsed = z.object({ id: uuid }).safeParse({ id: formData.get("id") });
  if (!parsed.success) redirect("/admin/carta?error=datos");

  const context = await requireCapability("manageMenu");
  const restaurantId = context.restaurant.restaurantId;

  try {
    await withDb(context.user.id, async (client) => {
      const rows = await client.query<{ item_count: number }>(
        `SELECT (SELECT count(*)::int FROM menu_items mi WHERE mi.category_id = c.id) AS item_count
         FROM menu_categories c WHERE c.id = $1 AND c.restaurant_id = $2`,
        [parsed.data.id, restaurantId],
      );
      const category = rows.rows[0];
      if (!category) throw new AppError("La categoría ya no existe.", "not_found", 404);
      if (category.item_count > 0) {
        throw new AppError(
          "No se puede eliminar una categoría con platos.",
          "conflict",
          409,
        );
      }

      await client.query("DELETE FROM menu_categories WHERE id = $1 AND restaurant_id = $2", [
        parsed.data.id,
        restaurantId,
      ]);
      await audit(client, {
        restaurantId,
        actorId: context.user.id,
        actorLabel: context.user.fullName,
        action: "menu.category_deleted",
        entity: "menu_category",
        entityId: parsed.data.id,
      });
    });
  } catch (error) {
    redirect(
      flash(
        "/admin/carta",
        "error",
        isAppError(error) && error.code === "conflict" ? "categoria_con_platos" : "datos",
      ),
    );
  }

  revalidatePath("/admin/carta");
  revalidatePath(`/carta/${context.restaurant.slug}`);
  redirect("/admin/carta?ok=categoria_eliminada");
}

const itemSchema = z.object({
  id: z.string().uuid().optional(),
  categoryId: uuid,
  stationId: uuid,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  ingredients: z.string().trim().max(500).optional(),
  price: z.string().trim().min(1),
  prepMinutes: z.coerce.number().int().min(1).max(180),
  sortOrder: z.coerce.number().int().min(0).max(999),
  imageUrl: z.string().trim().max(500).optional(),
  isAvailable: z.boolean(),
  isPublished: z.boolean(),
});

export async function saveMenuItemAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  const returnTo = safeReturnTo(
    formData.get("returnTo"),
    typeof id === "string" && id
      ? `/admin/carta/plato/${id}`
      : "/admin/carta/plato/nuevo",
  );

  const parsed = itemSchema.safeParse({
    id: typeof id === "string" && id ? id : undefined,
    categoryId: formData.get("categoryId"),
    stationId: formData.get("stationId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    ingredients: formData.get("ingredients") || undefined,
    price: formData.get("price"),
    prepMinutes: formData.get("prepMinutes") || 10,
    sortOrder: formData.get("sortOrder") || 0,
    imageUrl: formData.get("imageUrl") || undefined,
    isAvailable: formData.get("isAvailable") === "on",
    isPublished: formData.get("isPublished") === "on",
  });
  if (!parsed.success) redirect(flash(returnTo, "error", "datos"));

  const priceCents = parsePriceToCents(parsed.data.price);
  if (priceCents === null) redirect(flash(returnTo, "error", "precio"));

  const imageUrl = parsed.data.imageUrl || null;
  if (
    imageUrl &&
    !(
      imageUrl.startsWith("/demo/") ||
      imageUrl.startsWith("/uploads/") ||
      imageUrl.startsWith("https://")
    )
  ) {
    redirect(flash(returnTo, "error", "imagen"));
  }

  const allergens = formData
    .getAll("allergens")
    .map((value) => String(value))
    .filter(isAllergenKey);

  const context = await requireCapability("manageMenu");
  const restaurantId = context.restaurant.restaurantId;

  try {
    await withDb(context.user.id, async (client) => {
      const valid = await client.query(
        `SELECT 1 FROM menu_categories c, kitchen_stations ks
         WHERE c.id = $1 AND c.restaurant_id = $2
           AND ks.id = $3 AND ks.restaurant_id = $2`,
        [parsed.data.categoryId, restaurantId, parsed.data.stationId],
      );
      if (valid.rowCount === 0) {
        throw new AppError("La categoría o la estación ya no existen.", "not_found", 404);
      }

      if (parsed.data.id) {
        const updated = await client.query(
          `UPDATE menu_items
           SET category_id = $3, station_id = $4, name = $5, description = $6,
               ingredients = $7, allergens = $8, price_cents = $9, image_url = $10,
               prep_minutes = $11, sort_order = $12, is_available = $13, is_published = $14
           WHERE id = $1 AND restaurant_id = $2
           RETURNING id`,
          [
            parsed.data.id,
            restaurantId,
            parsed.data.categoryId,
            parsed.data.stationId,
            parsed.data.name,
            parsed.data.description || null,
            parsed.data.ingredients || null,
            allergens,
            priceCents,
            imageUrl,
            parsed.data.prepMinutes,
            parsed.data.sortOrder,
            parsed.data.isAvailable,
            parsed.data.isPublished,
          ],
        );
        if (updated.rowCount === 0) {
          throw new AppError("El plato ya no existe.", "not_found", 404);
        }
        await audit(client, {
          restaurantId,
          actorId: context.user.id,
          actorLabel: context.user.fullName,
          action: "menu.item_updated",
          entity: "menu_item",
          entityId: parsed.data.id,
          metadata: { name: parsed.data.name, price: priceCents },
        });
        return;
      }

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO menu_items
          (restaurant_id, category_id, station_id, name, description, ingredients, allergens,
           price_cents, image_url, prep_minutes, sort_order, is_available, is_published)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
        [
          restaurantId,
          parsed.data.categoryId,
          parsed.data.stationId,
          parsed.data.name,
          parsed.data.description || null,
          parsed.data.ingredients || null,
          allergens,
          priceCents,
          imageUrl,
          parsed.data.prepMinutes,
          parsed.data.sortOrder,
          parsed.data.isAvailable,
          parsed.data.isPublished,
        ],
      );
      await audit(client, {
        restaurantId,
        actorId: context.user.id,
        actorLabel: context.user.fullName,
        action: "menu.item_created",
        entity: "menu_item",
        entityId: inserted.rows[0]?.id ?? null,
        metadata: { name: parsed.data.name, price: priceCents },
      });
    });
  } catch (error) {
    redirect(
      flash(returnTo, "error", isAppError(error) && error.code === "not_found" ? "datos" : "datos"),
    );
  }

  revalidatePath("/admin/carta");
  revalidatePath(`/carta/${context.restaurant.slug}`);
  revalidatePath("/sala");
  redirect(flash(returnTo, "ok", "plato_guardado"));
}

export async function setMenuItemAvailabilityAction(formData: FormData): Promise<void> {
  const parsed = z
    .object({ id: uuid, available: z.enum(["1", "0"]) })
    .safeParse({
      id: formData.get("id"),
      available: formData.get("available"),
    });
  if (!parsed.success) redirect("/admin/carta?error=datos");

  const context = await requireCapability("manageMenu");
  const available = parsed.data.available === "1";

  await withDb(context.user.id, async (client) => {
    const updated = await client.query(
      `UPDATE menu_items SET is_available = $3
       WHERE id = $1 AND restaurant_id = $2 RETURNING id, name`,
      [parsed.data.id, context.restaurant.restaurantId, available],
    );
    if (updated.rowCount === 0) throw new AppError("El plato ya no existe.", "not_found", 404);
    await audit(client, {
      restaurantId: context.restaurant.restaurantId,
      actorId: context.user.id,
      actorLabel: context.user.fullName,
      action: "menu.item_availability_changed",
      entity: "menu_item",
      entityId: parsed.data.id,
      metadata: { available },
    });
  });

  revalidatePath("/admin/carta");
  revalidatePath(`/carta/${context.restaurant.slug}`);
  redirect(flash("/admin/carta", "ok", "plato_guardado"));
}

export async function archiveMenuItemAction(formData: FormData): Promise<void> {
  const parsed = z.object({ id: uuid }).safeParse({ id: formData.get("id") });
  if (!parsed.success) redirect("/admin/carta?error=datos");

  const context = await requireCapability("manageMenu");

  await withDb(context.user.id, async (client) => {
    const updated = await client.query(
      `UPDATE menu_items SET is_published = false, is_available = false
       WHERE id = $1 AND restaurant_id = $2 RETURNING id`,
      [parsed.data.id, context.restaurant.restaurantId],
    );
    if (updated.rowCount === 0) throw new AppError("El plato ya no existe.", "not_found", 404);
    await audit(client, {
      restaurantId: context.restaurant.restaurantId,
      actorId: context.user.id,
      actorLabel: context.user.fullName,
      action: "menu.item_archived",
      entity: "menu_item",
      entityId: parsed.data.id,
    });
  });

  revalidatePath("/admin/carta");
  revalidatePath(`/carta/${context.restaurant.slug}`);
  redirect("/admin/carta?ok=plato_archivado");
}
