"use server";

import { redirect } from "next/navigation";
import { getMemberships, getStaffContext, homeForRole, setActiveRestaurant } from "@/features/auth/session";

export async function switchRestaurantAction(formData: FormData): Promise<void> {
  const context = await getStaffContext();
  if (!context) redirect("/entrar");

  const restaurantId = String(formData.get("restaurantId") ?? "");
  const memberships = await getMemberships(context.user.id);
  const membership = memberships.find((item) => item.restaurantId === restaurantId);
  if (!membership) redirect(homeForRole(context.role));

  await setActiveRestaurant(membership.restaurantId);
  redirect(homeForRole(membership.role));
}
