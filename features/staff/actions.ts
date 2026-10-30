"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/features/audit/log";
import { requireCapability } from "@/features/auth/session";
import { withDb } from "@/lib/db";
import { AppError, isAppError } from "@/lib/errors";

const roleSchema = z.enum(["owner", "manager", "waiter", "kitchen"]);

function isDuplicate(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "23505";
}

export interface InviteState {
  ok: boolean;
  error?: string;
  name?: string;
  email?: string;
  password?: string;
  existing?: boolean;
}

export async function inviteMemberAction(
  _previous: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(120),
      email: z.string().trim().toLowerCase().email(),
      role: roleSchema,
    })
    .safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      role: formData.get("role"),
    });
  if (!parsed.success) {
    return { ok: false, error: "Revisa el nombre, el correo y el rol." };
  }

  const context = await requireCapability("manageStaff");
  const restaurantId = context.restaurant.restaurantId;
  const password = randomBytes(9).toString("base64url");
  let existing = false;

  try {
    await withDb(context.user.id, async (client) => {
      const found = await client.query<{ id: string }>(
        `SELECT id FROM app_users WHERE email = $1`,
        [parsed.data.email],
      );
      let userId = found.rows[0]?.id ?? null;
      let membershipId: string | null = null;

      if (userId) {
        const membership = await client.query(
          `SELECT 1 FROM restaurant_members WHERE restaurant_id = $1 AND user_id = $2`,
          [restaurantId, userId],
        );
        if (membership.rowCount && membership.rowCount > 0) {
          throw new AppError("Ese correo ya pertenece al equipo.", "conflict", 409);
        }
        existing = true;
      } else {
        const hash = await bcrypt.hash(password, 12);
        const inserted = await client.query<{ id: string }>(
          `SELECT api.create_staff_user($1, $2, $3, $4, $5::member_role) AS id`,
          [restaurantId, parsed.data.email, parsed.data.name, hash, parsed.data.role],
        );
        userId = inserted.rows[0]?.id ?? null;
        membershipId = userId;
      }

      if (!userId) throw new AppError("No se pudo crear el usuario.", "internal", 500);

      if (!membershipId) {
        const membership = await client.query<{ id: string }>(
          `INSERT INTO restaurant_members (restaurant_id, user_id, role)
           VALUES ($1, $2, $3::member_role) RETURNING id`,
          [restaurantId, userId, parsed.data.role],
        );
        membershipId = membership.rows[0]?.id ?? null;
      }

      await audit(client, {
        restaurantId,
        actorId: context.user.id,
        actorLabel: context.user.fullName,
        action: "staff.member_invited",
        entity: "restaurant_member",
        entityId: membershipId,
        metadata: { email: parsed.data.email, role: parsed.data.role, existing },
      });
    });
  } catch (error) {
    if (isAppError(error) && error.code === "conflict") {
      return { ok: false, error: "Ese correo ya pertenece al equipo." };
    }
    if (isDuplicate(error)) {
      return { ok: false, error: "Ese correo ya pertenece al equipo." };
    }
    return { ok: false, error: "No se pudo invitar. Inténtalo de nuevo." };
  }

  revalidatePath("/admin/equipo");
  return {
    ok: true,
    name: parsed.data.name,
    email: parsed.data.email,
    password: existing ? undefined : password,
    existing,
  };
}

export async function updateMemberRoleAction(formData: FormData): Promise<void> {
  const parsed = z
    .object({ id: z.string().uuid(), role: roleSchema })
    .safeParse({ id: formData.get("id"), role: formData.get("role") });
  if (!parsed.success) redirect("/admin/equipo?error=datos");

  const context = await requireCapability("manageStaff");
  const restaurantId = context.restaurant.restaurantId;

  try {
    await withDb(context.user.id, async (client) => {
      const current = await client.query<{ role: string; user_id: string }>(
        `SELECT role, user_id FROM restaurant_members
         WHERE id = $1 AND restaurant_id = $2 FOR UPDATE`,
        [parsed.data.id, restaurantId],
      );
      const member = current.rows[0];
      if (!member) throw new AppError("La persona ya no pertenece al equipo.", "not_found", 404);

      if (member.role === "owner" && parsed.data.role !== "owner") {
        const owners = await client.query<{ count: number }>(
          `SELECT count(*)::int AS count FROM restaurant_members
           WHERE restaurant_id = $1 AND role = 'owner'`,
          [restaurantId],
        );
        if ((owners.rows[0]?.count ?? 0) <= 1) {
          throw new AppError("No puede quedar el restaurante sin propietario.", "conflict", 409);
        }
      }

      await client.query(
        `UPDATE restaurant_members SET role = $3::member_role
         WHERE id = $1 AND restaurant_id = $2`,
        [parsed.data.id, restaurantId, parsed.data.role],
      );
      await audit(client, {
        restaurantId,
        actorId: context.user.id,
        actorLabel: context.user.fullName,
        action: "staff.role_changed",
        entity: "restaurant_member",
        entityId: parsed.data.id,
        metadata: { from: member.role, to: parsed.data.role },
      });
    });
  } catch (error) {
    redirect(
      `/admin/equipo?error=${
        isAppError(error) && error.code === "conflict" ? "ultimo_propietario" : "datos"
      }`,
    );
  }

  revalidatePath("/admin/equipo");
  redirect("/admin/equipo?ok=equipo_actualizado");
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse({ id: formData.get("id") });
  if (!parsed.success) redirect("/admin/equipo?error=datos");

  const context = await requireCapability("manageStaff");
  const restaurantId = context.restaurant.restaurantId;

  try {
    await withDb(context.user.id, async (client) => {
      const current = await client.query<{ role: string; user_id: string }>(
        `SELECT role, user_id FROM restaurant_members
         WHERE id = $1 AND restaurant_id = $2 FOR UPDATE`,
        [parsed.data.id, restaurantId],
      );
      const member = current.rows[0];
      if (!member) throw new AppError("La persona ya no pertenece al equipo.", "not_found", 404);
      if (member.user_id === context.user.id) {
        throw new AppError("No puedes retirar tu propio acceso.", "forbidden", 403);
      }
      if (member.role === "owner") {
        const owners = await client.query<{ count: number }>(
          `SELECT count(*)::int AS count FROM restaurant_members
           WHERE restaurant_id = $1 AND role = 'owner'`,
          [restaurantId],
        );
        if ((owners.rows[0]?.count ?? 0) <= 1) {
          throw new AppError("No puede quedar el restaurante sin propietario.", "conflict", 409);
        }
      }

      await client.query(
        `DELETE FROM restaurant_members WHERE id = $1 AND restaurant_id = $2`,
        [parsed.data.id, restaurantId],
      );
      await audit(client, {
        restaurantId,
        actorId: context.user.id,
        actorLabel: context.user.fullName,
        action: "staff.member_removed",
        entity: "restaurant_member",
        entityId: parsed.data.id,
        metadata: { user_id: member.user_id, role: member.role },
      });
    });
  } catch (error) {
    const code =
      isAppError(error) && error.code === "forbidden"
        ? "no_autoeliminar"
        : isAppError(error) && error.code === "conflict"
          ? "ultimo_propietario"
          : "datos";
    redirect(`/admin/equipo?error=${code}`);
  }

  revalidatePath("/admin/equipo");
  redirect("/admin/equipo?ok=equipo_eliminado");
}
