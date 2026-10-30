import "server-only";

import type { PoolClient } from "pg";

export async function audit(
  client: PoolClient,
  entry: {
    restaurantId: string | null;
    actorId: string | null;
    actorLabel: string;
    action: string;
    entity: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs
      (restaurant_id, actor_id, actor_label, action, entity, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      entry.restaurantId,
      entry.actorId,
      entry.actorLabel,
      entry.action,
      entry.entity,
      entry.entityId ?? null,
      JSON.stringify(entry.metadata ?? {}),
    ],
  );
}

export function safeReturnTo(value: FormDataEntryValue | null, fallback: string): string {
  const path = typeof value === "string" ? value : "";
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  if (path.includes("://") || path.includes("\\")) return fallback;
  return path;
}
