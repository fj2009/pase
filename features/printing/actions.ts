"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/features/audit/log";
import { requireCapability } from "@/features/auth/session";
import { withDb } from "@/lib/db";
import { AppError, isAppError } from "@/lib/errors";

const uuid = z.string().uuid();

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isDuplicate(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "23505";
}

const printerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  kind: z.enum(["test", "network", "usb_agent"]),
  target: z.string().trim().max(200).optional(),
  paperWidth: z.coerce.number().int().refine((value) => value === 58 || value === 80),
  isActive: z.boolean(),
});

export async function savePrinterAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  const parsed = printerSchema.safeParse({
    id: typeof id === "string" && id ? id : undefined,
    name: formData.get("name"),
    kind: formData.get("kind"),
    target: formData.get("target") || undefined,
    paperWidth: formData.get("paperWidth") || 80,
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) redirect("/admin/impresion?error=datos");

  if (parsed.data.kind !== "test" && !parsed.data.target) {
    redirect("/admin/impresion?error=datos");
  }

  const stationIds = formData
    .getAll("stationIds")
    .map((value) => String(value))
    .filter((value) => uuid.safeParse(value).success);

  const context = await requireCapability("managePrinters");
  const restaurantId = context.restaurant.restaurantId;

  try {
    await withDb(context.user.id, async (client) => {
      let printerId = parsed.data.id ?? null;

      if (printerId) {
        const updated = await client.query(
          `UPDATE printers
           SET name = $3, kind = $4::printer_kind, target = $5, paper_width = $6, is_active = $7
           WHERE id = $1 AND restaurant_id = $2 RETURNING id`,
          [
            printerId,
            restaurantId,
            parsed.data.name,
            parsed.data.kind,
            parsed.data.target || null,
            parsed.data.paperWidth,
            parsed.data.isActive,
          ],
        );
        if (updated.rowCount === 0) {
          throw new AppError("La impresora ya no existe.", "not_found", 404);
        }
        await client.query(
          `DELETE FROM printer_stations WHERE printer_id = $1 AND restaurant_id = $2`,
          [printerId, restaurantId],
        );
      } else {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO printers (restaurant_id, name, kind, target, paper_width, is_active)
           VALUES ($1, $2, $3::printer_kind, $4, $5, $6) RETURNING id`,
          [
            restaurantId,
            parsed.data.name,
            parsed.data.kind,
            parsed.data.target || null,
            parsed.data.paperWidth,
            parsed.data.isActive,
          ],
        );
        printerId = inserted.rows[0]?.id ?? null;
      }

      if (!printerId) throw new AppError("No se pudo guardar la impresora.", "internal", 500);

      if (stationIds.length > 0) {
        const stations = await client.query(
          `SELECT id FROM kitchen_stations
           WHERE restaurant_id = $1 AND id = ANY($2::uuid[])`,
          [restaurantId, stationIds],
        );
        for (const row of stations.rows as { id: string }[]) {
          await client.query(
            `INSERT INTO printer_stations (printer_id, station_id, restaurant_id)
             VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [printerId, row.id, restaurantId],
          );
        }
      }

      await audit(client, {
        restaurantId,
        actorId: context.user.id,
        actorLabel: context.user.fullName,
        action: parsed.data.id ? "printing.printer_updated" : "printing.printer_created",
        entity: "printer",
        entityId: printerId,
        metadata: { name: parsed.data.name, stations: stationIds.length },
      });
    });
  } catch (error) {
    redirect(`/admin/impresion?error=${isDuplicate(error) ? "impresora_duplicada" : "datos"}`);
  }

  revalidatePath("/admin/impresion");
  redirect("/admin/impresion?ok=impresora_guardada");
}

export async function deletePrinterAction(formData: FormData): Promise<void> {
  const parsed = z.object({ id: uuid }).safeParse({ id: formData.get("id") });
  if (!parsed.success) redirect("/admin/impresion?error=datos");

  const context = await requireCapability("managePrinters");
  const restaurantId = context.restaurant.restaurantId;
  let deactivated = false;

  try {
    await withDb(context.user.id, async (client) => {
      const active = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM print_jobs
         WHERE printer_id = $1 AND restaurant_id = $2
           AND status IN ('pending', 'processing')`,
        [parsed.data.id, restaurantId],
      );
      if ((active.rows[0]?.count ?? 0) > 0) {
        throw new AppError("La impresora tiene trabajos pendientes.", "conflict", 409);
      }

      const history = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM print_jobs
         WHERE printer_id = $1 AND restaurant_id = $2`,
        [parsed.data.id, restaurantId],
      );

      if ((history.rows[0]?.count ?? 0) > 0) {
        await client.query(
          `UPDATE printers SET is_active = false WHERE id = $1 AND restaurant_id = $2`,
          [parsed.data.id, restaurantId],
        );
        deactivated = true;
      } else {
        const deleted = await client.query(
          `DELETE FROM printers WHERE id = $1 AND restaurant_id = $2 RETURNING id`,
          [parsed.data.id, restaurantId],
        );
        if (deleted.rowCount === 0) {
          throw new AppError("La impresora ya no existe.", "not_found", 404);
        }
      }

      await audit(client, {
        restaurantId,
        actorId: context.user.id,
        actorLabel: context.user.fullName,
        action: deactivated ? "printing.printer_deactivated" : "printing.printer_deleted",
        entity: "printer",
        entityId: parsed.data.id,
      });
    });
  } catch (error) {
    redirect(
      `/admin/impresion?error=${
        isAppError(error) && error.code === "conflict" ? "impresora_ocupada" : "datos"
      }`,
    );
  }

  revalidatePath("/admin/impresion");
  redirect(`/admin/impresion?ok=${deactivated ? "impresora_desactivada" : "impresora_eliminada"}`);
}

export interface AgentState {
  ok: boolean;
  token?: string;
  error?: string;
}

export async function createPrintAgentAction(
  _previous: AgentState,
  formData: FormData,
): Promise<AgentState> {
  const parsed = z
    .object({ name: z.string().trim().min(1).max(80) })
    .safeParse({ name: formData.get("name") });
  if (!parsed.success) return { ok: false, error: "Pon un nombre al agente." };

  const context = await requireCapability("managePrinters");
  const token = randomBytes(32).toString("base64url");

  try {
    await withDb(context.user.id, async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO print_agents (restaurant_id, name, token_hash)
         VALUES ($1, $2, $3) RETURNING id`,
        [context.restaurant.restaurantId, parsed.data.name, hashToken(token)],
      );
      await audit(client, {
        restaurantId: context.restaurant.restaurantId,
        actorId: context.user.id,
        actorLabel: context.user.fullName,
        action: "printing.agent_created",
        entity: "print_agent",
        entityId: inserted.rows[0]?.id ?? null,
        metadata: { name: parsed.data.name },
      });
    });
  } catch {
    return { ok: false, error: "No se pudo crear el token. Inténtalo de nuevo." };
  }

  revalidatePath("/admin/impresion");
  return { ok: true, token };
}

export async function revokePrintAgentAction(formData: FormData): Promise<void> {
  const parsed = z.object({ id: uuid }).safeParse({ id: formData.get("id") });
  if (!parsed.success) redirect("/admin/impresion?error=datos");

  const context = await requireCapability("managePrinters");

  await withDb(context.user.id, async (client) => {
    const updated = await client.query(
      `UPDATE print_agents SET revoked_at = now()
       WHERE id = $1 AND restaurant_id = $2 AND revoked_at IS NULL RETURNING id`,
      [parsed.data.id, context.restaurant.restaurantId],
    );
    if (updated.rowCount === 0) {
      throw new AppError("El token ya no existe o está revocado.", "not_found", 404);
    }
    await audit(client, {
      restaurantId: context.restaurant.restaurantId,
      actorId: context.user.id,
      actorLabel: context.user.fullName,
      action: "printing.agent_revoked",
      entity: "print_agent",
      entityId: parsed.data.id,
    });
  });

  revalidatePath("/admin/impresion");
  redirect("/admin/impresion?ok=agente_revocado");
}

export async function testPrintAction(formData: FormData): Promise<void> {
  const parsed = z.object({ id: uuid }).safeParse({ id: formData.get("id") });
  if (!parsed.success) redirect("/admin/impresion?error=datos");

  const context = await requireCapability("managePrinters");
  const restaurantId = context.restaurant.restaurantId;

  try {
    await withDb(context.user.id, async (client) => {
      const rows = await client.query<{
        id: string;
        name: string;
        kind: string;
        target: string | null;
        paper_width: number;
        is_active: boolean;
      }>(
        `SELECT id, name, kind, target, paper_width, is_active
         FROM printers WHERE id = $1 AND restaurant_id = $2`,
        [parsed.data.id, restaurantId],
      );
      const printer = rows.rows[0];
      if (!printer) throw new AppError("La impresora ya no existe.", "not_found", 404);
      if (!printer.is_active) {
        throw new AppError("La impresora está desactivada.", "conflict", 409);
      }

      await client.query(
        `INSERT INTO print_jobs
          (restaurant_id, printer_id, payload, idempotency_key, created_by)
         VALUES ($1, $2, $3::jsonb, $4, $5)`,
        [
          restaurantId,
          printer.id,
          JSON.stringify({
            type: "test",
            restaurant: { name: context.restaurant.name },
            order: null,
            printer: {
              id: printer.id,
              name: printer.name,
              paper_width: printer.paper_width,
            },
            items: [
              {
                name: "Prueba de impresión",
                quantity: 1,
                notes: "Si lees esto, la impresora está bien configurada.",
                allergens: [],
                station: "Sistema",
              },
            ],
            generated_at: new Date().toISOString(),
          }),
          `test:${randomUUID()}`,
          context.user.id,
        ],
      );

      await audit(client, {
        restaurantId,
        actorId: context.user.id,
        actorLabel: context.user.fullName,
        action: "printing.test_ticket_queued",
        entity: "printer",
        entityId: printer.id,
      });
    });
  } catch (error) {
    redirect(
      `/admin/impresion?error=${
        isAppError(error) && error.code === "conflict" ? "impresora_ocupada" : "datos"
      }`,
    );
  }

  revalidatePath("/admin/impresion");
  redirect("/admin/impresion?ok=prueba_impresion");
}

export async function retryPrintJobAction(formData: FormData): Promise<void> {
  const parsed = z.object({ id: uuid }).safeParse({ id: formData.get("id") });
  if (!parsed.success) redirect("/admin/impresion?error=datos");

  const context = await requireCapability("managePrinters");

  await withDb(context.user.id, async (client) => {
    const updated = await client.query(
      `UPDATE print_jobs
       SET status = 'pending', attempts = 0, last_error = NULL, next_attempt_at = now()
       WHERE id = $1 AND restaurant_id = $2 AND status IN ('failed', 'pending')
       RETURNING id`,
      [parsed.data.id, context.restaurant.restaurantId],
    );
    if (updated.rowCount === 0) {
      throw new AppError("El trabajo no se puede reintentar.", "conflict", 409);
    }
    await audit(client, {
      restaurantId: context.restaurant.restaurantId,
      actorId: context.user.id,
      actorLabel: context.user.fullName,
      action: "printing.job_retried",
      entity: "print_job",
      entityId: parsed.data.id,
    });
  });

  revalidatePath("/admin/impresion");
  redirect("/admin/impresion?ok=trabajo_reintentado");
}
