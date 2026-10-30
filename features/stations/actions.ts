"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/features/audit/log";
import { requireCapability } from "@/features/auth/session";
import { withDb } from "@/lib/db";
import { AppError, isAppError } from "@/lib/errors";

const stationSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  capacity: z.coerce.number().int().min(1).max(12),
  sortOrder: z.coerce.number().int().min(0).max(999),
  isActive: z.boolean(),
});

function isDuplicate(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "23505";
}

export async function saveStationAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  const parsed = stationSchema.safeParse({
    id: typeof id === "string" && id ? id : undefined,
    name: formData.get("name"),
    capacity: formData.get("capacity") || 1,
    sortOrder: formData.get("sortOrder") || 0,
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) redirect("/admin/estaciones?error=datos");

  const context = await requireCapability("manageMenu");
  const restaurantId = context.restaurant.restaurantId;

  try {
    await withDb(context.user.id, async (client) => {
      if (parsed.data.id) {
        const updated = await client.query(
          `UPDATE kitchen_stations
           SET name = $3, capacity = $4, sort_order = $5, is_active = $6
           WHERE id = $1 AND restaurant_id = $2 RETURNING id`,
          [
            parsed.data.id,
            restaurantId,
            parsed.data.name,
            parsed.data.capacity,
            parsed.data.sortOrder,
            parsed.data.isActive,
          ],
        );
        if (updated.rowCount === 0) {
          throw new AppError("La estación ya no existe.", "not_found", 404);
        }
        await audit(client, {
          restaurantId,
          actorId: context.user.id,
          actorLabel: context.user.fullName,
          action: "stations.station_updated",
          entity: "kitchen_station",
          entityId: parsed.data.id,
          metadata: { name: parsed.data.name },
        });
        return;
      }

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO kitchen_stations (restaurant_id, name, capacity, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          restaurantId,
          parsed.data.name,
          parsed.data.capacity,
          parsed.data.sortOrder,
          parsed.data.isActive,
        ],
      );
      await audit(client, {
        restaurantId,
        actorId: context.user.id,
        actorLabel: context.user.fullName,
        action: "stations.station_created",
        entity: "kitchen_station",
        entityId: inserted.rows[0]?.id ?? null,
        metadata: { name: parsed.data.name },
      });
    });
  } catch (error) {
    redirect(`/admin/estaciones?error=${isDuplicate(error) ? "estacion_duplicada" : "datos"}`);
  }

  revalidatePath("/admin/estaciones");
  revalidatePath("/cocina");
  revalidatePath("/sala");
  redirect("/admin/estaciones?ok=estacion_guardada");
}

export async function deleteStationAction(formData: FormData): Promise<void> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse({ id: formData.get("id") });
  if (!parsed.success) redirect("/admin/estaciones?error=datos");

  const context = await requireCapability("manageMenu");
  const restaurantId = context.restaurant.restaurantId;

  try {
    await withDb(context.user.id, async (client) => {
      const items = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM menu_items
         WHERE station_id = $1 AND restaurant_id = $2`,
        [parsed.data.id, restaurantId],
      );
      if ((items.rows[0]?.count ?? 0) > 0) {
        throw new AppError("La estación tiene platos asignados.", "conflict", 409);
      }

      const printers = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM printer_stations
         WHERE station_id = $1 AND restaurant_id = $2`,
        [parsed.data.id, restaurantId],
      );
      if ((printers.rows[0]?.count ?? 0) > 0) {
        await client.query(
          `UPDATE kitchen_stations SET is_active = false
           WHERE id = $1 AND restaurant_id = $2`,
          [parsed.data.id, restaurantId],
        );
      } else {
        const deleted = await client.query(
          `DELETE FROM kitchen_stations WHERE id = $1 AND restaurant_id = $2 RETURNING id`,
          [parsed.data.id, restaurantId],
        );
        if (deleted.rowCount === 0) {
          throw new AppError("La estación ya no existe.", "not_found", 404);
        }
      }

      await audit(client, {
        restaurantId,
        actorId: context.user.id,
        actorLabel: context.user.fullName,
        action: "stations.station_deleted",
        entity: "kitchen_station",
        entityId: parsed.data.id,
      });
    });
  } catch (error) {
    redirect(
      `/admin/estaciones?error=${
        isAppError(error) && error.code === "conflict" ? "estacion_con_platos" : "datos"
      }`,
    );
  }

  revalidatePath("/admin/estaciones");
  revalidatePath("/cocina");
  redirect("/admin/estaciones?ok=estacion_eliminada");
}
