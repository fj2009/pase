import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { config } from "dotenv";

const root = join(import.meta.dirname, "..");
config({ path: join(root, ".env.local") });
config({ path: join(root, ".env") });
const migrationsDir = join(root, "db", "migrations");

export async function withOwner(fn) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function migrate() {
  return withOwner(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const files = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    const applied = new Set(
      (await client.query("SELECT version FROM schema_migrations")).rows.map(
        (row) => row.version,
      ),
    );

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`= ${file} (ya aplicada)`);
        continue;
      }
      const sql = readFileSync(join(migrationsDir, file), "utf8");
      console.log(`→ ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [
          file,
        ]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  });
}

export async function seed() {
  if (process.env.PASE_ENV === "production") {
    throw new Error("db/seed.sql no puede ejecutarse con PASE_ENV=production");
  }
  const sql = readFileSync(join(root, "db", "seed.sql"), "utf8");
  await withOwner(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

if (process.argv[1] && process.argv[1].endsWith("migrate.mjs")) {
  migrate()
    .then(() => console.log("Migraciones al día."))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
