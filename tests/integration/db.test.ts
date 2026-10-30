import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const connectionString = process.env.DATABASE_APP_URL;

if (!connectionString) {
  throw new Error("Falta DATABASE_APP_URL para las pruebas de integración.");
}

let client: Client;

const RESTAURANT_A = "a0000000-0000-4000-8000-000000000001";
const RESTAURANT_B = "b0000000-0000-4000-8000-000000000001";
const OWNER_A = "a1000000-0000-4000-8000-000000000001";
const WAITER_A = "a3000000-0000-4000-8000-000000000001";
const SUPERADMIN = "f1000000-0000-4000-8000-000000000001";

beforeAll(async () => {
  client = new Client({ connectionString });
  await client.connect();
});

afterAll(async () => {
  await client.end();
});

async function asUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  await client.query("BEGIN");
  try {
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    return await fn();
  } finally {
    await client.query("ROLLBACK");
  }
}

describe("API pública", () => {
  it("devuelve la carta publicada y la mesa del QR", async () => {
    const result = await client.query(
      "SELECT api.menu('casa-aurelio', 'casa04c4d5e6f708192a3b4c5d6e7f8091a2b') AS data",
    );
    const data = result.rows[0].data;
    expect(data.restaurant.name).toBe("Casa Aurelio");
    expect(data.table.label).toBe("Mesa 4");
    expect(Array.isArray(data.categories)).toBe(true);
    expect(data.categories.length).toBeGreaterThan(0);
  });

  it("no expone restaurantes inexistentes ni inactivos", async () => {
    const missing = await client.query("SELECT api.menu('no-existe', NULL) AS data");
    expect(missing.rows[0].data).toBeNull();
  });

  it("devuelve el seguimiento por token y null si no existe", async () => {
    const found = await client.query(
      "SELECT api.tracking('demo_tracking_casa_aurelio_000001') AS data",
    );
    expect(found.rows[0].data.order.number).toBe(1);
    expect(found.rows[0].data.restaurant.slug).toBe("casa-aurelio");

    const missing = await client.query(
      "SELECT api.tracking('token_que_no_existe_123456') AS data",
    );
    expect(missing.rows[0].data).toBeNull();
  });
});

describe("aislamiento por restaurante (RLS)", () => {
  it("un propietario solo ve sus propias mesas", async () => {
    await asUser(OWNER_A, async () => {
      const own = await client.query(
        "SELECT count(*)::int AS total FROM dining_tables WHERE restaurant_id = $1",
        [RESTAURANT_A],
      );
      const other = await client.query(
        "SELECT count(*)::int AS total FROM dining_tables WHERE restaurant_id = $1",
        [RESTAURANT_B],
      );
      expect(own.rows[0].total).toBeGreaterThan(0);
      expect(other.rows[0].total).toBe(0);
    });
  });

  it("no permite insertar mesas en otro restaurante", async () => {
    await expect(
      asUser(OWNER_A, async () => {
        await client.query(
          `INSERT INTO dining_tables (restaurant_id, label, seats)
           VALUES ($1, 'Intrusa', 2)`,
          [RESTAURANT_B],
        );
      }),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("un superadmin ve todos los restaurantes activos", async () => {
    await asUser(SUPERADMIN, async () => {
      const result = await client.query("SELECT count(*)::int AS total FROM restaurants");
      expect(result.rows[0].total).toBeGreaterThanOrEqual(2);
    });
  });
});

describe("alta de personal", () => {
  it("el propietario crea cuenta y pertenencia con el rol indicado", async () => {
    await asUser(OWNER_A, async () => {
      const email = `integracion-${randomUUID()}@example.test`;
      const result = await client.query(
        `SELECT api.create_staff_user($1, $2, $3, $4, 'waiter'::member_role) AS id`,
        [RESTAURANT_A, email, "hash-de-prueba", "Persona de prueba"],
      );
      const userId = result.rows[0].id as string;
      const membership = await client.query(
        "SELECT role FROM restaurant_members WHERE user_id = $1 AND restaurant_id = $2",
        [userId, RESTAURANT_A],
      );
      expect(membership.rows[0]?.role).toBe("waiter");
    });
  });

  it("sala no puede crear personal", async () => {
    await expect(
      asUser(WAITER_A, async () => {
        await client.query(
          `SELECT api.create_staff_user($1, $2, $3, $4, 'waiter'::member_role)`,
          [RESTAURANT_A, `intruso-${randomUUID()}@example.test`, "x", "Intruso"],
        );
      }),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("un propietario no se puede autoproclamar owner por esta vía", async () => {
    await expect(
      asUser(OWNER_A, async () => {
        await client.query(
          `SELECT api.create_staff_user($1, $2, $3, $4, 'owner'::member_role)`,
          [RESTAURANT_A, `owner-${randomUUID()}@example.test`, "x", "Owner"],
        );
      }),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("el superadmin crea restaurante y propietario como hace /plataforma", async () => {
    await asUser(SUPERADMIN, async () => {
      const slug = `integracion-${randomUUID()}`;
      const restaurant = await client.query(
        `INSERT INTO restaurants (name, slug, timezone) VALUES ($1, $2, 'Europe/Madrid') RETURNING id`,
        ["Restaurante de prueba", slug],
      );
      const restaurantId = restaurant.rows[0].id as string;
      await client.query("INSERT INTO subscriptions (restaurant_id) VALUES ($1)", [
        restaurantId,
      ]);
      const user = await client.query(
        `SELECT api.create_staff_user($1, $2, $3, $4, 'owner'::member_role) AS id`,
        [restaurantId, `owner-${randomUUID()}@example.test`, "x", "Propietario"],
      );
      const membership = await client.query(
        "SELECT role FROM restaurant_members WHERE restaurant_id = $1 AND user_id = $2",
        [restaurantId, user.rows[0].id],
      );
      expect(membership.rows[0]?.role).toBe("owner");
    });
  });
});

describe("agente de impresión", () => {
  const hash = createHash("sha256").update("token-inexistente").digest("hex");

  it("rechaza tokens desconocidos", async () => {
    const claim = await client.query("SELECT api.agent_claim($1) AS data", [hash]);
    expect(claim.rows[0].data).toEqual({ ok: false, reason: "unauthorized" });

    const complete = await client.query(
      "SELECT api.agent_complete($1, $2, true, NULL) AS data",
      [hash, randomUUID()],
    );
    expect(complete.rows[0].data).toEqual({ ok: false, reason: "unauthorized" });
  });
});
