"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PoolClient } from "pg";
import { z } from "zod";
import { requireCapability, requireRestaurant } from "@/features/auth/session";
import { audit, safeReturnTo } from "@/features/audit/log";
import { enqueueTickets, type TicketItem } from "@/features/printing/queue";
import {
  canTransition,
  type ItemStatus,
} from "@/features/orders/state-machine";
import { withDb } from "@/lib/db";
import { AppError, isAppError } from "@/lib/errors";
import type { StaffContext } from "@/features/auth/session";

const uuid = z.string().uuid();

const orderSchema = z.object({
  tableId: uuid,
  sessionId: uuid.nullish(),
  orderId: uuid.nullish(),
  notes: z.string().trim().max(500).nullish(),
  idempotencyKey: z.string().min(10).max(120),
  items: z
    .array(
      z.object({
        menuItemId: uuid,
        quantity: z.number().int().min(1).max(99),
        notes: z.string().trim().max(300).nullish(),
      }),
    )
    .min(1)
    .max(40),
});

type OrderInput = z.infer<typeof orderSchema>;

export interface OrderActionState {
  error?: string;
}

interface SavedOrder {
  id: string;
  number: number;
  token: string;
  createdAt: Date;
  tableId: string;
  tableLabel: string;
}

interface MenuRow {
  id: string;
  name: string;
  price_cents: number;
  prep_minutes: number;
  station_id: string;
  station_name: string;
  allergens: string[];
  is_available: boolean;
  is_published: boolean;
}

function flash(path: string, key: string, value: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${value}`;
}

async function findOrderByKey(
  client: PoolClient,
  restaurantId: string,
  key: string,
): Promise<SavedOrder | null> {
  const rows = await client.query<{
    id: string;
    order_number: number;
    tracking_token: string;
    created_at: Date;
    table_id: string;
    table_label: string;
  }>(
    `SELECT o.id, o.order_number, o.tracking_token, o.created_at, o.table_id, t.label AS table_label
     FROM orders o
     JOIN dining_tables t ON t.id = o.table_id
     WHERE o.restaurant_id = $1 AND o.idempotency_key = $2`,
    [restaurantId, key],
  );
  const row = rows.rows[0];
  return row
    ? {
        id: row.id,
        number: row.order_number,
        token: row.tracking_token,
        createdAt: row.created_at,
        tableId: row.table_id,
        tableLabel: row.table_label,
      }
    : null;
}

async function findOrderByLineKey(
  client: PoolClient,
  restaurantId: string,
  key: string,
): Promise<SavedOrder | null> {
  const rows = await client.query<{
    id: string;
    order_number: number;
    tracking_token: string;
    created_at: Date;
    table_id: string;
    table_label: string;
  }>(
    `SELECT o.id, o.order_number, o.tracking_token, o.created_at, o.table_id, t.label AS table_label
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN dining_tables t ON t.id = o.table_id
     WHERE oi.restaurant_id = $1 AND oi.idempotency_key = $2`,
    [restaurantId, `${key}:0`],
  );
  const row = rows.rows[0];
  return row
    ? {
        id: row.id,
        number: row.order_number,
        token: row.tracking_token,
        createdAt: row.created_at,
        tableId: row.table_id,
        tableLabel: row.table_label,
      }
    : null;
}

async function saveOrder(
  client: PoolClient,
  ctx: StaffContext & { restaurant: NonNullable<StaffContext["restaurant"]>; role: NonNullable<StaffContext["role"]> },
  input: OrderInput,
): Promise<SavedOrder> {
  const restaurantId = ctx.restaurant.restaurantId;
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [restaurantId]);

  let order: SavedOrder;

  if (input.orderId) {
    const existing = await client.query<{
      id: string;
      order_number: number;
      tracking_token: string;
      created_at: Date;
      table_id: string;
      table_label: string;
    }>(
      `SELECT o.id, o.order_number, o.tracking_token, o.created_at, o.table_id, t.label AS table_label
       FROM orders o
       JOIN dining_tables t ON t.id = o.table_id
       WHERE o.id = $1 AND o.restaurant_id = $2 AND o.status = 'open'`,
      [input.orderId, restaurantId],
    );
    const row = existing.rows[0];
    if (!row) {
      throw new AppError(
        "La comanda ya no está abierta. Recarga la mesa para comprobar el servicio.",
        "conflict",
        409,
      );
    }
    order = {
      id: row.id,
      number: row.order_number,
      token: row.tracking_token,
      createdAt: row.created_at,
      tableId: row.table_id,
      tableLabel: row.table_label,
    };

    const repeated = await findOrderByLineKey(client, restaurantId, input.idempotencyKey);
    if (repeated) return repeated;
  } else {
    const repeated =
      (await findOrderByKey(client, restaurantId, input.idempotencyKey)) ??
      (await findOrderByLineKey(client, restaurantId, input.idempotencyKey));
    if (repeated) return repeated;

    if (!input.sessionId) {
      throw new AppError("Selecciona una mesa con el servicio abierto.", "validation");
    }

    const session = await client.query<{ table_label: string }>(
      `SELECT t.label AS table_label
       FROM service_sessions ss
       JOIN dining_tables t ON t.id = ss.table_id
       WHERE ss.id = $1 AND ss.table_id = $2 AND ss.restaurant_id = $3 AND ss.status = 'open'`,
      [input.sessionId, input.tableId, restaurantId],
    );
    if (!session.rows[0]) {
      throw new AppError(
        "La mesa no tiene un servicio abierto. Abre la mesa antes de tomar la comanda.",
        "conflict",
        409,
      );
    }

    const inserted = await client.query<{
      id: string;
      order_number: number;
      tracking_token: string;
      created_at: Date;
    }>(
      `INSERT INTO orders
        (restaurant_id, table_id, service_session_id, order_number, notes, idempotency_key, created_by)
       VALUES (
         $1, $2, $3,
         (SELECT COALESCE(MAX(order_number), 0) + 1 FROM orders WHERE restaurant_id = $1),
         $4, $5, $6
       )
       RETURNING id, order_number, tracking_token, created_at`,
      [
        restaurantId,
        input.tableId,
        input.sessionId,
        input.notes || null,
        input.idempotencyKey,
        ctx.user.id,
      ],
    );
    const row = inserted.rows[0];
    if (!row) throw new AppError("No se ha podido crear la comanda.", "internal", 500);
    order = {
      id: row.id,
      number: row.order_number,
      token: row.tracking_token,
      createdAt: row.created_at,
      tableId: input.tableId,
      tableLabel: session.rows[0].table_label,
    };
  }

  const menuIds = [...new Set(input.items.map((item) => item.menuItemId))];
  const menu = await client.query<MenuRow>(
    `SELECT mi.id, mi.name, mi.price_cents, mi.prep_minutes, mi.station_id,
            ks.name AS station_name, mi.allergens, mi.is_available, mi.is_published
     FROM menu_items mi
     JOIN kitchen_stations ks ON ks.id = mi.station_id
     WHERE mi.restaurant_id = $1 AND mi.id = ANY($2::uuid[])`,
    [restaurantId, menuIds],
  );
  const byId = new Map(menu.rows.map((row) => [row.id, row]));

  const ticketItems: TicketItem[] = [];
  const itemIds: string[] = [];
  const stationIds = new Set<string>();

  for (const [index, line] of input.items.entries()) {
    const dish = byId.get(line.menuItemId);
    if (!dish || !dish.is_available || !dish.is_published) {
      throw new AppError(
        "Uno de los platos ya no está disponible. Recarga la carta y revisa la comanda.",
        "conflict",
        409,
      );
    }

    const insertedItem = await client.query<{ id: string }>(
      `INSERT INTO order_items
        (restaurant_id, order_id, menu_item_id, station_id, name_snapshot, unit_price_cents,
         prep_minutes_snapshot, quantity, notes, idempotency_key, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        restaurantId,
        order.id,
        dish.id,
        dish.station_id,
        dish.name,
        dish.price_cents,
        dish.prep_minutes,
        line.quantity,
        line.notes || null,
        `${input.idempotencyKey}:${index}`,
        ctx.user.id,
      ],
    );
    const itemId = insertedItem.rows[0]?.id;
    if (!itemId) throw new AppError("No se ha podido guardar un plato.", "internal", 500);

    await client.query(
      `INSERT INTO kitchen_events (restaurant_id, order_item_id, from_status, to_status, actor_id)
       VALUES ($1, $2, NULL, 'queued', $3)`,
      [restaurantId, itemId, ctx.user.id],
    );

    itemIds.push(itemId);
    stationIds.add(dish.station_id);
    ticketItems.push({
      name: dish.name,
      quantity: line.quantity,
      notes: line.notes || null,
      allergens: dish.allergens,
      stationId: dish.station_id,
      stationName: dish.station_name,
    });
  }

  await enqueueTickets(client, {
    restaurant: { id: restaurantId, name: ctx.restaurant.name },
    order: {
      id: order.id,
      number: order.number,
      tableLabel: order.tableLabel,
      createdAt: order.createdAt,
      notes: input.notes || null,
    },
    items: ticketItems,
    itemIds,
    stationIds: [...stationIds],
    batchKey: input.idempotencyKey,
    createdBy: ctx.user.id,
  });

  await audit(client, {
    restaurantId,
    actorId: ctx.user.id,
    actorLabel: ctx.user.fullName,
    action: input.orderId ? "order.items_added" : "order.created",
    entity: "order",
    entityId: order.id,
    metadata: {
      number: order.number,
      table: order.tableLabel,
      items: input.items.length,
    },
  });

  return order;
}

export async function submitOrderAction(
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const raw = formData.get("payload");
  if (typeof raw !== "string") {
    return { error: "No se ha recibido la comanda." };
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { error: "La comanda no tiene un formato válido." };
  }

  const parsed = orderSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Revisa los platos y las cantidades de la comanda." };
  }

  const ctx = await requireCapability("takeOrders");
  let saved: SavedOrder;

  try {
    saved = await withDb(ctx.user.id, (client) => saveOrder(client, ctx, parsed.data));
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    const pgError = error as { code?: string };
    if (pgError.code === "23505") {
      return {
        error:
          "No se ha podido confirmar la comanda. Recarga la mesa antes de volver a enviarla para evitar duplicados.",
      };
    }
    console.error("[orders] no se ha podido guardar la comanda", error);
    return { error: "No se ha podido enviar la comanda. Inténtalo de nuevo." };
  }

  revalidatePath("/sala");
  revalidatePath("/cocina");
  revalidatePath(`/sala/mesa/${saved.tableId}`);
  redirect(
    `/sala/mesa/${saved.tableId}?ok=${parsed.data.orderId ? "lineas" : "comanda"}`,
  );
}

const statusSchema = z.object({
  itemId: uuid,
  to: z.enum(["queued", "preparing", "incident", "ready", "delivered", "cancelled"]),
  returnTo: z.string().max(200).optional(),
  note: z.string().trim().max(300).optional(),
});

export async function updateItemStatusAction(formData: FormData): Promise<void> {
  const fallback = "/cocina";
  const rawReturn = safeReturnTo(formData.get("returnTo"), fallback);
  const parsed = statusSchema.safeParse({
    itemId: formData.get("itemId"),
    to: formData.get("to"),
    returnTo: formData.get("returnTo"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    redirect(flash(rawReturn, "error", "datos"));
  }

  const ctx = await requireRestaurant();
  const kitchenPath =
    ctx.role === "waiter" ? "/sala" : rawReturn.startsWith("/cocina") ? rawReturn : fallback;

  try {
    await withDb(ctx.user.id, async (client) => {
      const rows = await client.query<{
        id: string;
        status: ItemStatus;
        order_id: string;
        name_snapshot: string;
        order_number: number;
      }>(
        `SELECT oi.id, oi.status, oi.order_id, oi.name_snapshot, o.order_number
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE oi.id = $1 AND oi.restaurant_id = $2`,
        [parsed.data.itemId, ctx.restaurant.restaurantId],
      );
      const item = rows.rows[0];
      if (!item) throw new AppError("El plato ya no existe.", "not_found", 404);

      const check = canTransition(item.status, parsed.data.to, ctx.role);
      if (!check.ok) {
        throw new AppError(
          check.reason,
          check.reason.includes("rol") ? "forbidden" : "conflict",
          409,
        );
      }
      if (parsed.data.to === "incident" && !parsed.data.note) {
        throw new AppError("Describe brevemente la incidencia.", "validation");
      }

      const updated = await client.query(
        `UPDATE order_items
         SET status = $3::order_item_status,
             started_at = CASE WHEN $3 = 'preparing' THEN COALESCE(started_at, now()) ELSE started_at END,
             ready_at = CASE WHEN $3 = 'ready' THEN now() ELSE ready_at END,
             delivered_at = CASE WHEN $3 = 'delivered' THEN now() ELSE delivered_at END,
             cancelled_at = CASE WHEN $3 = 'cancelled' THEN now() ELSE cancelled_at END,
             incident_note = CASE WHEN $3 = 'incident' THEN $4 ELSE incident_note END
         WHERE id = $1 AND restaurant_id = $2 AND status = $5`,
        [
          item.id,
          ctx.restaurant.restaurantId,
          parsed.data.to,
          parsed.data.note ?? null,
          item.status,
        ],
      );
      if (updated.rowCount === 0) {
        throw new AppError(
          "Otro usuario ha cambiado el estado del plato. La pantalla se ha actualizado.",
          "conflict",
          409,
        );
      }

      await client.query(
        `INSERT INTO kitchen_events
          (restaurant_id, order_item_id, from_status, to_status, actor_id, note)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          ctx.restaurant.restaurantId,
          item.id,
          item.status,
          parsed.data.to,
          ctx.user.id,
          parsed.data.note ?? null,
        ],
      );

      await audit(client, {
        restaurantId: ctx.restaurant.restaurantId,
        actorId: ctx.user.id,
        actorLabel: ctx.user.fullName,
        action: "order_item.status_changed",
        entity: "order_item",
        entityId: item.id,
        metadata: {
          order: item.order_number,
          dish: item.name_snapshot,
          from: item.status,
          to: parsed.data.to,
        },
      });
    });
  } catch (error) {
    const code = isAppError(error)
      ? error.code === "validation"
        ? "datos"
        : error.code === "forbidden"
          ? "permiso"
          : "transicion"
      : "transicion";
    redirect(flash(kitchenPath, "error", code));
  }

  revalidatePath("/cocina");
  revalidatePath("/sala");
  redirect(flash(kitchenPath, "ok", "estado"));
}

const cancelSchema = z.object({
  itemId: uuid,
  returnTo: z.string().max(200).optional(),
  reason: z.string().trim().max(300).optional(),
});

export async function cancelItemAction(formData: FormData): Promise<void> {
  const fallback = "/sala";
  const returnTo = safeReturnTo(formData.get("returnTo"), fallback);
  const parsed = cancelSchema.safeParse({
    itemId: formData.get("itemId"),
    returnTo: formData.get("returnTo"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) redirect(flash(returnTo, "error", "datos"));

  const ctx = await requireCapability("cancelItems");

  try {
    await withDb(ctx.user.id, async (client) => {
      const rows = await client.query<{
        id: string;
        status: ItemStatus;
        name_snapshot: string;
        order_number: number;
      }>(
        `SELECT oi.id, oi.status, oi.name_snapshot, o.order_number
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE oi.id = $1 AND oi.restaurant_id = $2`,
        [parsed.data.itemId, ctx.restaurant.restaurantId],
      );
      const item = rows.rows[0];
      if (!item) throw new AppError("El plato ya no existe.", "not_found", 404);

      const check = canTransition(item.status, "cancelled", ctx.role);
      if (!check.ok) throw new AppError(check.reason, "conflict", 409);

      const updated = await client.query(
        `UPDATE order_items
         SET status = 'cancelled', cancelled_at = now(), cancel_reason = $3
         WHERE id = $1 AND restaurant_id = $2 AND status = $4`,
        [item.id, ctx.restaurant.restaurantId, parsed.data.reason ?? "Cancelado por el equipo", item.status],
      );
      if (updated.rowCount === 0) {
        throw new AppError("El plato ya ha cambiado de estado.", "conflict", 409);
      }

      await client.query(
        `INSERT INTO kitchen_events
          (restaurant_id, order_item_id, from_status, to_status, actor_id, note)
         VALUES ($1, $2, $3, 'cancelled', $4, $5)`,
        [
          ctx.restaurant.restaurantId,
          item.id,
          item.status,
          ctx.user.id,
          parsed.data.reason ?? null,
        ],
      );

      await audit(client, {
        restaurantId: ctx.restaurant.restaurantId,
        actorId: ctx.user.id,
        actorLabel: ctx.user.fullName,
        action: "order_item.cancelled",
        entity: "order_item",
        entityId: item.id,
        metadata: {
          order: item.order_number,
          dish: item.name_snapshot,
          reason: parsed.data.reason ?? null,
        },
      });
    });
  } catch (error) {
    redirect(
      flash(returnTo, "error", isAppError(error) && error.code === "forbidden" ? "permiso" : "transicion"),
    );
  }

  revalidatePath("/cocina");
  revalidatePath("/sala");
  redirect(flash(returnTo, "ok", "cancelado"));
}

const sessionSchema = z.object({
  tableId: uuid,
  sessionId: uuid.optional(),
  returnTo: z.string().max(200).optional(),
});

export async function openSessionAction(formData: FormData): Promise<void> {
  const returnTo = safeReturnTo(formData.get("returnTo"), "/sala");
  const parsed = sessionSchema.safeParse({
    tableId: formData.get("tableId"),
    returnTo: formData.get("returnTo"),
  });
  if (!parsed.success) redirect(flash(returnTo, "error", "datos"));

  const ctx = await requireCapability("manageService");

  try {
    const table = await withDb(ctx.user.id, async (client) => {
      const rows = await client.query<{ id: string; label: string }>(
        `SELECT id, label FROM dining_tables
         WHERE id = $1 AND restaurant_id = $2 AND is_active`,
        [parsed.data.tableId, ctx.restaurant.restaurantId],
      );
      const found = rows.rows[0];
      if (!found) throw new AppError("La mesa no existe o está desactivada.", "not_found", 404);

      const open = await client.query("SELECT id FROM service_sessions WHERE table_id = $1 AND status = 'open'", [
        found.id,
      ]);
      if (open.rows[0]) return found;

      const inserted = await client.query("INSERT INTO service_sessions (restaurant_id, table_id, opened_by) VALUES ($1, $2, $3) RETURNING id", [
        ctx.restaurant.restaurantId,
        found.id,
        ctx.user.id,
      ]);

      await audit(client, {
        restaurantId: ctx.restaurant.restaurantId,
        actorId: ctx.user.id,
        actorLabel: ctx.user.fullName,
        action: "service.opened",
        entity: "service_session",
        entityId: inserted.rows[0]?.id ?? null,
        metadata: { table: found.label },
      });

      return found;
    });

    revalidatePath("/sala");
    revalidatePath(`/sala/mesa/${table.id}`);
    redirect(`/sala/mesa/${table.id}?ok=mesa_abierta`);
  } catch (error) {
    if (isAppError(error)) redirect(flash(returnTo, "error", "datos"));
    throw error;
  }
}

export async function closeSessionAction(formData: FormData): Promise<void> {
  const returnTo = safeReturnTo(formData.get("returnTo"), "/sala");
  const parsed = sessionSchema.safeParse({
    tableId: formData.get("tableId"),
    sessionId: formData.get("sessionId"),
    returnTo: formData.get("returnTo"),
  });
  if (!parsed.success || !parsed.data.sessionId) {
    redirect(flash(returnTo, "error", "datos"));
  }

  const ctx = await requireCapability("manageService");

  try {
    await withDb(ctx.user.id, async (client) => {
      const rows = await client.query<{ id: string; table_id: string; status: string }>(
        `SELECT id, table_id, status FROM service_sessions
         WHERE id = $1 AND restaurant_id = $2 AND table_id = $3`,
        [parsed.data.sessionId, ctx.restaurant.restaurantId, parsed.data.tableId],
      );
      const session = rows.rows[0];
      if (!session) throw new AppError("El servicio ya no existe.", "not_found", 404);

      await client.query(
        `UPDATE service_sessions
         SET status = 'closed', closed_at = now(), closed_by = $3
         WHERE id = $1 AND restaurant_id = $2 AND status = 'open'`,
        [session.id, ctx.restaurant.restaurantId, ctx.user.id],
      );
      await client.query(
        `UPDATE orders
         SET status = 'closed', closed_at = now()
         WHERE service_session_id = $1 AND restaurant_id = $2 AND status = 'open'`,
        [session.id, ctx.restaurant.restaurantId],
      );
      await client.query(
        `UPDATE bill_requests
         SET status = 'completed', completed_at = now()
         WHERE service_session_id = $1 AND restaurant_id = $2
           AND status IN ('requested', 'attending')`,
        [session.id, ctx.restaurant.restaurantId],
      );

      await audit(client, {
        restaurantId: ctx.restaurant.restaurantId,
        actorId: ctx.user.id,
        actorLabel: ctx.user.fullName,
        action: "service.closed",
        entity: "service_session",
        entityId: session.id,
      });
    });
  } catch (error) {
    redirect(flash(returnTo, "error", isAppError(error) ? "datos" : "datos"));
  }

  revalidatePath("/sala");
  revalidatePath("/cocina");
  revalidatePath("/admin");
  redirect(flash(returnTo, "ok", "mesa_cerrada"));
}

const billSchema = z.object({
  billId: uuid,
  status: z.enum(["attending", "completed", "cancelled"]),
  returnTo: z.string().max(200).optional(),
});

export async function updateBillStatusAction(formData: FormData): Promise<void> {
  const returnTo = safeReturnTo(formData.get("returnTo"), "/sala/cuentas");
  const parsed = billSchema.safeParse({
    billId: formData.get("billId"),
    status: formData.get("status"),
    returnTo: formData.get("returnTo"),
  });
  if (!parsed.success) redirect(flash(returnTo, "error", "datos"));

  const ctx = await requireCapability("manageService");

  try {
    await withDb(ctx.user.id, async (client) => {
      const rows = await client.query<{ id: string; status: string }>(
        `SELECT id, status FROM bill_requests
         WHERE id = $1 AND restaurant_id = $2`,
        [parsed.data.billId, ctx.restaurant.restaurantId],
      );
      const bill = rows.rows[0];
      if (!bill) throw new AppError("La solicitud ya no existe.", "not_found", 404);

      const allowed =
        (bill.status === "requested" && ["attending", "completed", "cancelled"].includes(parsed.data.status)) ||
        (bill.status === "attending" && ["completed", "cancelled"].includes(parsed.data.status));
      if (!allowed) throw new AppError("Ese cambio ya no es posible.", "conflict", 409);

      await client.query(
        `UPDATE bill_requests
         SET status = $3::bill_request_status,
             attended_at = CASE WHEN $3 = 'attending' THEN COALESCE(attended_at, now()) ELSE attended_at END,
             attended_by = CASE WHEN $3 = 'attending' THEN $4 ELSE attended_by END,
             completed_at = CASE WHEN $3 = 'completed' THEN now() ELSE completed_at END,
             cancelled_at = CASE WHEN $3 = 'cancelled' THEN now() ELSE cancelled_at END
         WHERE id = $1 AND restaurant_id = $2`,
        [bill.id, ctx.restaurant.restaurantId, parsed.data.status, ctx.user.id],
      );

      await audit(client, {
        restaurantId: ctx.restaurant.restaurantId,
        actorId: ctx.user.id,
        actorLabel: ctx.user.fullName,
        action: "bill.status_changed",
        entity: "bill_request",
        entityId: bill.id,
        metadata: { from: bill.status, to: parsed.data.status },
      });
    });
  } catch {
    redirect(flash(returnTo, "error", "cuenta_error"));
  }

  revalidatePath("/sala");
  revalidatePath("/sala/cuentas");
  redirect(flash(returnTo, "ok", "cuenta"));
}

const reprintSchema = z.object({
  orderId: uuid,
  returnTo: z.string().max(200).optional(),
});

export async function reprintOrderAction(formData: FormData): Promise<void> {
  const returnTo = safeReturnTo(formData.get("returnTo"), "/sala");
  const parsed = reprintSchema.safeParse({
    orderId: formData.get("orderId"),
    returnTo: formData.get("returnTo"),
  });
  if (!parsed.success) redirect(flash(returnTo, "error", "datos"));

  const ctx = await requireCapability("reprintTickets");

  try {
    await withDb(ctx.user.id, async (client) => {
      const orderRows = await client.query<{
        id: string;
        order_number: number;
        created_at: Date;
        notes: string | null;
        table_label: string;
      }>(
        `SELECT o.id, o.order_number, o.created_at, o.notes, t.label AS table_label
         FROM orders o
         JOIN dining_tables t ON t.id = o.table_id
         WHERE o.id = $1 AND o.restaurant_id = $2`,
        [parsed.data.orderId, ctx.restaurant.restaurantId],
      );
      const order = orderRows.rows[0];
      if (!order) throw new AppError("La comanda no existe.", "not_found", 404);

      const itemRows = await client.query<{
        id: string;
        name_snapshot: string;
        quantity: number;
        notes: string | null;
        station_id: string;
        station_name: string;
        allergens: string[];
      }>(
        `SELECT oi.id, oi.name_snapshot, oi.quantity, oi.notes, oi.station_id,
                ks.name AS station_name, COALESCE(mi.allergens, '{}') AS allergens
         FROM order_items oi
         JOIN kitchen_stations ks ON ks.id = oi.station_id
         LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
         WHERE oi.order_id = $1 AND oi.restaurant_id = $2 AND oi.status <> 'cancelled'
         ORDER BY oi.queued_at`,
        [order.id, ctx.restaurant.restaurantId],
      );
      if (itemRows.rows.length === 0) {
        throw new AppError("La comanda no tiene platos para reimprimir.", "validation");
      }

      const lastJobs = await client.query<{ printer_id: string; id: string }>(
        `SELECT DISTINCT ON (printer_id) printer_id, id
         FROM print_jobs
         WHERE order_id = $1 AND restaurant_id = $2
         ORDER BY printer_id, created_at DESC`,
        [order.id, ctx.restaurant.restaurantId],
      );
      const reprintOf = Object.fromEntries(lastJobs.rows.map((row) => [row.printer_id, row.id]));

      const created = await enqueueTickets(client, {
        restaurant: { id: ctx.restaurant.restaurantId, name: ctx.restaurant.name },
        order: {
          id: order.id,
          number: order.order_number,
          tableLabel: order.table_label,
          createdAt: order.created_at,
          notes: order.notes,
        },
        items: itemRows.rows.map((row) => ({
          name: row.name_snapshot,
          quantity: row.quantity,
          notes: row.notes,
          allergens: row.allergens,
          stationId: row.station_id,
          stationName: row.station_name,
        })),
        itemIds: itemRows.rows.map((row) => row.id),
        stationIds: [...new Set(itemRows.rows.map((row) => row.station_id))],
        batchKey: `reprint:${order.id}:${Date.now()}`,
        createdBy: ctx.user.id,
        mode: "reprint",
        reprintOf,
      });

      if (created === 0) {
        throw new AppError(
          "La comanda no tiene impresoras activas asignadas a sus estaciones.",
          "unavailable",
          503,
        );
      }

      await audit(client, {
        restaurantId: ctx.restaurant.restaurantId,
        actorId: ctx.user.id,
        actorLabel: ctx.user.fullName,
        action: "print.reprinted",
        entity: "order",
        entityId: order.id,
        metadata: { number: order.order_number, jobs: created },
      });
    });
  } catch (error) {
    redirect(flash(returnTo, "error", isAppError(error) && error.code === "unavailable" ? "impresora" : "datos"));
  }

  revalidatePath("/admin/impresion");
  redirect(flash(returnTo, "ok", "reimpresion"));
}
