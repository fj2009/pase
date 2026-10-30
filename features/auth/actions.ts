"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { compare } from "bcryptjs";
import { z } from "zod";
import { publicQuery, userQuery } from "@/lib/db";
import { createSessionForUser, destroySession, homeForRole } from "@/features/auth/session";
import type { Role } from "@/features/permissions/capabilities";

export interface LoginState {
  error?: string;
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Introduce un correo válido."),
  password: z.string().min(1, "Introduce tu contraseña."),
});

const DUMMY_HASH =
  "$2b$10$2uRyqir32vtrb.8zFGbikO3rvsAz.YG1axmilqVRXPZCdCEeKtlfq";

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }

  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    "local";
  const allowed = await publicQuery<{ allowed: boolean }>(
    "SELECT api.hit_rate_limit($1, $2, $3) AS allowed",
    [`login:${ip}:${parsed.data.email}`, 8, 300],
  );

  if (!allowed[0]?.allowed) {
    return {
      error: "Demasiados intentos. Espera unos minutos antes de volver a probar.",
    };
  }

  const rows = await publicQuery<{
    user_id: string;
    password_hash: string;
    full_name: string;
    is_active: boolean;
    is_superadmin: boolean;
  }>("SELECT * FROM api.authenticate($1)", [parsed.data.email]);

  const account = rows[0];
  const valid = await compare(parsed.data.password, account?.password_hash ?? DUMMY_HASH);

  if (!account || !valid || !account.is_active) {
    return { error: "Correo o contraseña incorrectos." };
  }

  await createSessionForUser(account.user_id);

  const memberships = await userQuery<{ role: Role }>(
    account.user_id,
    "SELECT role FROM restaurant_members WHERE user_id = $1 LIMIT 1",
    [account.user_id],
  );
  const role = memberships[0]?.role ?? null;

  if (!role && !account.is_superadmin) {
    await destroySession();
    return { error: "Tu cuenta no está asociada a ningún restaurante." };
  }

  redirect(role ? homeForRole(role) : "/plataforma");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/entrar");
}
