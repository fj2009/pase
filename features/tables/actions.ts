"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit, safeReturnTo } from "@/features/audit/log";
import { requireCapability } from "@/features/auth/session";
import { withDb } from "@/lib/db";
import { AppError, isAppError } from "@/lib/errors";

const uuid = z.string().uuid();

function flash(path: string, key: string, value: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${value}`;
}

const tableSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(40),
  zone: z.string().trim().max(40).optional(),
  seats: z.coerce.number().int().min(1).max(40),
  isActive: z.boolean(),
});

export async function saveTableAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  const returnTo = safeReturnTo(
    formData.get("returnTo"),
    typeof id === "string" && id ? `/admin/mesas/${id}` : "/admin/mesas/nueva",
  );
  const parsed = tableSchema.safeParse({
    id: typeof id === "string" && id ? id : undefined,
    label: formData.get("label"),
    zone: formData.get("zone") || undefined,
    seats: formData.get("seats") || 2,
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) redirect(flash(returnTo, "error", "datos"));

  const context = await requireCapability("manageTables");
  const restaurantId = context.restaurant.restaurantId;

  try {
    await withDb(context.user.id, async (client) => {
      if (parsed.data.id) {
        const updated = await client.query(
          `UPDATE dining_tables SET label = $3, zone = $4, seats = $5, is_active = $6
           WHERE id = $1 AND restaurant_id = $2 RETURNING id`,
          [
            parsed.data.id,
            restaurantId,
            parsed.data.label,
            parsed.data.zone || null,
            parsed.data.seats,
            parsed.data.isActive,
          ],
        );
        if (updated.rowCount === 0) {
          throw new AppError("La mesa ya no existe.", "not_found", 404);
        }
        await audit(client, {
          restaurantId,
          actorId: context.user.id,
          actorLabel: context.user.fullName,
          action: "tables.table_updated",
          entity: "dining_table",
          entityId: parsed.data.id,
          metadata: { label: parsed.data.label },
        });
        return;
      }

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO dining_tables (restaurant_id, label, zone, seats, is_active)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          restaurantId,
          parsed.data.label,
          parsed.data.zone || null,
          parsed.data.seats,
          parsed.data.isActive,
        ],
      );
      await audit(client, {
        restaurantId,
        actorId: context.user.id,
        actorLabel: context.user.fullName,
        action: "tables.table_created",
        entity: "dining_table",
        entityId: inserted.rows[0]?.id ?? null,
        metadata: { label: parsed.data.label },
      });
    });
  } catch (error) {
    const duplicate =
      isAppError(error) && error.code === "conflict" && error.status === 409
        ? true
        : typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: string }).code === "23505";
    redirect(
      flash(
        returnTo,
        "error",
        duplicate ? "mesa_duplicada" : isAppError(error) ? "datos" : "datos",
      ),
    );
  }

  revalidatePath("/admin/mesas");
  revalidatePath("/sala");
  redirect("/admin/mesas?ok=mesa_guardada");
}

export async function regenerateTableQrAction(formData: FormData): Promise<void> {
  const parsed = z.object({ id: uuid }).safeParse({ id: formData.get("id") });
  if (!parsed.success) redirect("/admin/mesas?error=datos");

  const context = await requireCapability("manageTables");

  await withDb(context.user.id, async (client) => {
    const updated = await client.query(
      `UPDATE dining_tables
       SET qr_token = encode(gen_random_bytes(24), 'hex')
       WHERE id = $1 AND restaurant_id = $2 RETURNING id`,
      [parsed.data.id, context.restaurant.restaurantId],
    );
    if (updated.rowCount === 0) throw new AppError("La mesa ya no existe.", "not_found", 404);
    await audit(client, {
      restaurantId: context.restaurant.restaurantId,
      actorId: context.user.id,
      actorLabel: context.user.fullName,
      action: "tables.qr_regenerated",
      entity: "dining_table",
      entityId: parsed.data.id,
    });
  });

  revalidatePath("/admin/mesas");
  redirect(`/admin/mesas/${parsed.data.id}?ok=qr_regenerado`);
}

export async function deleteTableAction(formData: FormData): Promise<void> {
  const parsed = z.object({ id: uuid }).safeParse({ id: formData.get("id") });
  if (!parsed.success) redirect("/admin/mesas?error=datos");

  const context = await requireCapability("manageTables");
  const restaurantId = context.restaurant.restaurantId;
  let deactivated = false;

  try {
    await withDb(context.user.id, async (client) => {
      const open = await client.query(
        `SELECT 1 FROM service_sessions
         WHERE table_id = $1 AND restaurant_id = $2 AND status = 'open'`,
        [parsed.data.id, restaurantId],
      );
      if (open.rowCount && open.rowCount > 0) {
        throw new AppError("La mesa tiene un servicio abierto.", "conflict", 409);
      }

      const history = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM service_sessions
         WHERE table_id = $1 AND restaurant_id = $2`,
        [parsed.data.id, restaurantId],
      );

      if ((history.rows[0]?.count ?? 0) > 0) {
        await client.query(
          `UPDATE dining_tables SET is_active = false
           WHERE id = $1 AND restaurant_id = $2`,
          [parsed.data.id, restaurantId],
        );
        deactivated = true;
      } else {
        await client.query(
          `DELETE FROM dining_tables WHERE id = $1 AND restaurant_id = $2`,
          [parsed.data.id, restaurantId],
        );
      }

      await audit(client, {
        restaurantId,
        actorId: context.user.id,
        actorLabel: context.user.fullName,
        action: deactivated ? "tables.table_deactivated" : "tables.table_deleted",
        entity: "dining_table",
        entityId: parsed.data.id,
      });
    });
  } catch (error) {
    redirect(
      flash(
        "/admin/mesas",
        "error",
        isAppError(error) && error.code === "conflict" ? "mesa_en_servicio" : "datos",
      ),
    );
  }

  revalidatePath("/admin/mesas");
  revalidatePath("/sala");
  redirect(`/admin/mesas?ok=${deactivated ? "mesa_desactivada" : "mesa_eliminada"}`);
}
