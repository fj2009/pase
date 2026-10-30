import "server-only";

import { Pool, type PoolClient } from "pg";
import { env } from "@/lib/env";

type GlobalWithPool = typeof globalThis & {
  pasePool?: Pool;
};

const globalWithPool = globalThis as GlobalWithPool;

export const pool =
  globalWithPool.pasePool ??
  new Pool({
    connectionString: env.DATABASE_APP_URL,
    max: 10,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 5_000,
    application_name: "pase-web",
  });

if (env.PASE_ENV !== "production") {
  globalWithPool.pasePool = pool;
}

pool.on("error", (error) => {
  console.error("[db] error en conexión inactiva", error.message);
});

export async function withDb<T>(
  userId: string | null,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.user_id', $1, true)", [
      userId ?? "",
    ]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // La conexión ya no está disponible.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function publicQuery<T>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return withDb(null, async (client) => {
    const result = await client.query(sql, params);
    return result.rows as T[];
  });
}

export async function userQuery<T>(
  userId: string,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return withDb(userId, async (client) => {
    const result = await client.query(sql, params);
    return result.rows as T[];
  });
}
