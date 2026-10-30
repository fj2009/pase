import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createHmac, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { publicQuery, userQuery } from "@/lib/db";
import { env } from "@/lib/env";
import { can, type Capability, type Role } from "@/features/permissions/capabilities";

export const SESSION_COOKIE = "pase_session";
const RESTAURANT_COOKIE = "pase_restaurant";
const SESSION_HOURS = 12;

export function hashToken(token: string): string {
  return createHmac("sha256", env.SESSION_SECRET).update(token).digest("hex");
}

interface SessionRow {
  session_id: string;
  user_id: string;
  email: string;
  full_name: string;
  is_superadmin: boolean;
  expires_at: Date;
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  isSuperadmin: boolean;
}

export interface Membership {
  restaurantId: string;
  name: string;
  slug: string;
  role: Role;
  accent: "olive" | "terracotta";
  timezone: string;
  logoUrl: string | null;
}

export interface StaffContext {
  user: SessionUser;
  memberships: Membership[];
  restaurant: Membership | null;
  role: Role | null;
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await publicQuery<SessionRow>("SELECT * FROM api.resolve_session($1)", [
    hashToken(token),
  ]);
  const row = rows[0];
  if (!row) return null;

  return {
    id: row.user_id,
    email: row.email,
    fullName: row.full_name,
    isSuperadmin: row.is_superadmin,
  };
});

export async function getMemberships(userId: string): Promise<Membership[]> {
  const rows = await userQuery<{
    restaurant_id: string;
    name: string;
    slug: string;
    role: Role;
    accent: "olive" | "terracotta";
    timezone: string;
    logo_url: string | null;
  }>(
    userId,
    `SELECT r.id AS restaurant_id, r.name, r.slug, m.role, r.accent, r.timezone, r.logo_url
     FROM restaurant_members m
     JOIN restaurants r ON r.id = m.restaurant_id
     WHERE m.user_id = $1 AND r.is_active
     ORDER BY r.name`,
    [userId],
  );

  return rows.map((row) => ({
    restaurantId: row.restaurant_id,
    name: row.name,
    slug: row.slug,
    role: row.role,
    accent: row.accent,
    timezone: row.timezone,
    logoUrl: row.logo_url,
  }));
}

export async function getStaffContext(): Promise<StaffContext | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const memberships = await getMemberships(user.id);
  const store = await cookies();
  const preferred = store.get(RESTAURANT_COOKIE)?.value;
  const restaurant =
    memberships.find((item) => item.restaurantId === preferred) ??
    memberships[0] ??
    null;

  return {
    user,
    memberships,
    restaurant,
    role: restaurant?.role ?? null,
  };
}

export function homeForRole(role: Role | null): string {
  if (role === "kitchen") return "/cocina";
  if (role === "waiter") return "/sala";
  return "/admin";
}

export async function requireStaff(): Promise<StaffContext> {
  const context = await getStaffContext();
  if (!context) redirect("/entrar");
  return context;
}

export async function requireRestaurant(): Promise<StaffContext & { restaurant: Membership; role: Role }> {
  const context = await requireStaff();
  if (!context.restaurant || !context.role) {
    redirect("/plataforma");
  }
  return context as StaffContext & { restaurant: Membership; role: Role };
}

export async function requireCapability(
  capability: Capability,
): Promise<StaffContext & { restaurant: Membership; role: Role }> {
  const context = await requireRestaurant();
  if (!can(context.role, capability)) {
    redirect(`${homeForRole(context.role)}?error=permiso`);
  }
  return context;
}

export async function requireSuperadmin(): Promise<StaffContext> {
  const context = await requireStaff();
  if (!context.user.isSuperadmin) {
    redirect(homeForRole(context.role));
  }
  return context;
}

export async function createSessionForUser(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent")?.slice(0, 300) ?? null;
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    "";

  await publicQuery("SELECT api.create_auth_session($1, $2, $3, $4, $5)", [
    userId,
    hashToken(token),
    userAgent,
    ip,
    SESSION_HOURS,
  ]);

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.IS_PRODUCTION,
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await publicQuery("SELECT api.revoke_session($1)", [hashToken(token)]);
  }
  store.delete(SESSION_COOKIE);
}

export async function setActiveRestaurant(restaurantId: string): Promise<void> {
  const store = await cookies();
  store.set(RESTAURANT_COOKIE, restaurantId, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.IS_PRODUCTION,
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}
