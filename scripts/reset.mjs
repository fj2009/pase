import { withOwner, migrate, seed } from "./migrate.mjs";

if (process.env.PASE_ENV === "production") {
  console.error("db:reset está bloqueado con PASE_ENV=production");
  process.exit(1);
}

await withOwner(async (client) => {
  await client.query("DROP SCHEMA IF EXISTS api CASCADE");
  await client.query("DROP SCHEMA IF EXISTS app CASCADE");
  await client.query("DROP SCHEMA IF EXISTS public CASCADE");
  await client.query("CREATE SCHEMA public");
  console.log("Esquema reiniciado.");
});

await migrate();
await seed();
console.log("Base de datos de demostración lista.");
process.exit(0);
