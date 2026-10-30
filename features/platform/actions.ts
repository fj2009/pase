"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/features/audit/log";
import { requireSuperadmin } from "@/features/auth/session";
import { withDb } from "@/lib/db";
import { AppError, isAppError } from "@/lib/errors";

function isDuplicate(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "23505";
}

export interface CreateRestaurantState {
  ok: boolean;
  error?: string;
  name?: string;
  ownerEmail?: string;
  password?: string;
  existing?: boolean;
}

export async function createRestaurantAction(
  _previous: CreateRestaurantState,
  formData: FormData,
): Promise<CreateRestaurantState> {
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(120),
      slug: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug no válido.")
        .max(80),
      address: z.string().trim().max(200).optional(),
      phone: z.string().trim().max(40).optional(),
      timezone: z.string().trim().min(3).max(60),
      accent: z.enum(["olive", "terracotta"]),
      ownerName: z.string().trim().max(120).optional(),
      ownerEmail: z.string().trim().toLowerCase().email().optional(),
    })
    .refine(
      (value) => Boolean(value.ownerName) === Boolean(value.ownerEmail),
      "Indica nombre y correo del propietario, o deja ambos vacíos.",
    )
    .safeParse({
      name: formData.get("name"),
      slug: formData.get("slug"),
      address: formData.get("address") || undefined,
      phone: formData.get("phone") || undefined,
      timezone: formData.get("timezone") || "Europe/Madrid",
      accent: formData.get("accent") || "olive",
      ownerName: formData.get("ownerName") || undefined,
      ownerEmail: formData.get("ownerEmail") || undefined,
    });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }

  const context = await requireSuperadmin();
  const password = randomBytes(9).toString("base64url");
  let existing = false;

  try {
    await withDb(context.user.id, async (client) => {
      const restaurant = await client.query<{ id: string }>(
        `INSERT INTO restaurants (name, slug, address, phone, timezone, accent)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          parsed.data.name,
          parsed.data.slug,
          parsed.data.address || null,
          parsed.data.phone || null,
          parsed.data.timezone,
          parsed.data.accent,
        ],
      );
      const restaurantId = restaurant.rows[0]?.id;
      if (!restaurantId) throw new AppError("No se pudo crear el restaurante.", "internal", 500);

      await client.query(
        `INSERT INTO subscriptions (restaurant_id, plan, status, seats, current_period_end)
         VALUES ($1, 'trial', 'trialing', 5, now() + interval '30 days')`,
        [restaurantId],
      );

      for (const [name, capacity, sortOrder] of [
        ["Cocina", 2, 1],
        ["Barra", 2, 2],
      ] as const) {
        await client.query(
          `INSERT INTO kitchen_stations (restaurant_id, name, capacity, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [restaurantId, name, capacity, sortOrder],
        );
      }

      if (parsed.data.ownerEmail && parsed.data.ownerName) {
        const found = await client.query<{ id: string }>(
          `SELECT id FROM app_users WHERE email = $1`,
          [parsed.data.ownerEmail],
        );
        let userId = found.rows[0]?.id ?? null;
        let membershipCreated = false;
        if (userId) {
          existing = true;
        } else {
          const hash = await bcrypt.hash(password, 12);
          const inserted = await client.query<{ id: string }>(
            `SELECT api.create_staff_user($1, $2, $3, $4, 'owner'::member_role) AS id`,
            [restaurantId, parsed.data.ownerEmail, parsed.data.ownerName, hash],
          );
          userId = inserted.rows[0]?.id ?? null;
          membershipCreated = true;
        }
        if (!userId) throw new AppError("No se pudo crear el propietario.", "internal", 500);

        if (!membershipCreated) {
          await client.query(
            `INSERT INTO restaurant_members (restaurant_id, user_id, role)
             VALUES ($1, $2, 'owner')`,
            [restaurantId, userId],
          );
        }
      }

      await audit(client, {
        restaurantId,
        actorId: context.user.id,
        actorLabel: context.user.fullName,
        action: "platform.restaurant_created",
        entity: "restaurant",
        entityId: restaurantId,
        metadata: { slug: parsed.data.slug, owner: parsed.data.ownerEmail ?? null },
      });
    });
  } catch (error) {
    if (isDuplicate(error)) {
      return { ok: false, error: "Ese slug ya está en uso. Elige otro." };
    }
    if (isAppError(error)) return { ok: false, error: error.message };
    return { ok: false, error: "No se pudo crear el restaurante. Inténtalo de nuevo." };
  }

  revalidatePath("/plataforma");
  return {
    ok: true,
    name: parsed.data.name,
    ownerEmail: parsed.data.ownerEmail,
    password: parsed.data.ownerEmail && !existing ? password : undefined,
    existing,
  };
}

export async function setRestaurantActiveAction(formData: FormData): Promise<void> {
  const parsed = z
    .object({ id: z.string().uuid(), active: z.enum(["1", "0"]) })
    .safeParse({ id: formData.get("id"), active: formData.get("active") });
  if (!parsed.success) redirect("/plataforma?error=datos");

  const context = await requireSuperadmin();
  const active = parsed.data.active === "1";

  await withDb(context.user.id, async (client) => {
    const updated = await client.query(
      `UPDATE restaurants SET is_active = $2 WHERE id = $1 RETURNING name`,
      [parsed.data.id, active],
    );
    if (updated.rowCount === 0) throw new AppError("El restaurante no existe.", "not_found", 404);
    await audit(client, {
      restaurantId: parsed.data.id,
      actorId: context.user.id,
      actorLabel: context.user.fullName,
      action: "platform.restaurant_status_changed",
      entity: "restaurant",
      entityId: parsed.data.id,
      metadata: { active },
    });
  });

  revalidatePath("/plataforma");
  redirect("/plataforma?ok=restaurante_desactivado");
}

export async function updateSubscriptionAction(formData: FormData): Promise<void> {
  const parsed = z
    .object({
      id: z.string().uuid(),
      plan: z.enum(["trial", "basic", "pro"]),
      status: z.enum(["trialing", "active", "past_due", "cancelled"]),
      seats: z.coerce.number().int().min(1).max(500),
    })
    .safeParse({
      id: formData.get("id"),
      plan: formData.get("plan"),
      status: formData.get("status"),
      seats: formData.get("seats"),
    });
  if (!parsed.success) redirect("/plataforma?error=datos");

  const context = await requireSuperadmin();

  await withDb(context.user.id, async (client) => {
    const updated = await client.query(
      `UPDATE subscriptions SET plan = $2, status = $3::subscription_status, seats = $4
       WHERE restaurant_id = $1 RETURNING id`,
      [parsed.data.id, parsed.data.plan, parsed.data.status, parsed.data.seats],
    );
    if (updated.rowCount === 0) throw new AppError("Suscripción no encontrada.", "not_found", 404);
    await audit(client, {
      restaurantId: parsed.data.id,
      actorId: context.user.id,
      actorLabel: context.user.fullName,
      action: "platform.subscription_updated",
      entity: "subscription",
      entityId: parsed.data.id,
      metadata: { plan: parsed.data.plan, status: parsed.data.status, seats: parsed.data.seats },
    });
  });

  revalidatePath("/plataforma");
  redirect("/plataforma?ok=restaurante_guardado");
}
