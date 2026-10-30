import "server-only";

import { userQuery } from "@/lib/db";
import type { Role } from "@/features/permissions/capabilities";

export interface AdminMember {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export async function getMembers(
  userId: string,
  restaurantId: string,
): Promise<AdminMember[]> {
  const rows = await userQuery<{
    id: string;
    user_id: string;
    email: string;
    full_name: string;
    role: Role;
    is_active: boolean;
    created_at: Date;
    last_login_at: Date | null;
  }>(
    userId,
    `SELECT m.id, u.id AS user_id, u.email, u.full_name, m.role, u.is_active,
            m.created_at, u.last_login_at
     FROM restaurant_members m
     JOIN app_users u ON u.id = m.user_id
     WHERE m.restaurant_id = $1
     ORDER BY CASE m.role
       WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 WHEN 'waiter' THEN 2 ELSE 3 END,
       u.full_name`,
    [restaurantId],
  );

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    lastLoginAt: row.last_login_at?.toISOString() ?? null,
  }));
}
