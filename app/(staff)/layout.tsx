import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { requireRestaurant } from "@/features/auth/session";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const context = await requireRestaurant();
  return <AppShell context={context}>{children}</AppShell>;
}
