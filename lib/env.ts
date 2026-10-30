import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "Falta DATABASE_URL"),
  DATABASE_APP_URL: z.string().min(1, "Falta DATABASE_APP_URL"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET debe tener al menos 32 caracteres"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3010"),
  APP_TIMEZONE: z.string().default("Europe/Madrid"),
  PASE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_APP_URL: process.env.DATABASE_APP_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  APP_TIMEZONE: process.env.APP_TIMEZONE,
  PASE_ENV: process.env.PASE_ENV,
});

if (!parsed.success) {
  const detail = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Configuración de entorno inválida:\n${detail}`);
}

export const env = {
  ...parsed.data,
  IS_PRODUCTION: parsed.data.PASE_ENV === "production",
  SITE_URL: parsed.data.NEXT_PUBLIC_SITE_URL.replace(/\/$/, ""),
};
