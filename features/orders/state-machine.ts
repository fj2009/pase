import type { Role } from "@/features/permissions/capabilities";

export type ItemStatus =
  | "queued"
  | "preparing"
  | "incident"
  | "ready"
  | "delivered"
  | "cancelled";

export const ACTIVE_STATUSES: ItemStatus[] = [
  "queued",
  "preparing",
  "incident",
  "ready",
];

export const STATUS_LABELS: Record<ItemStatus, string> = {
  queued: "En cola",
  preparing: "En preparación",
  incident: "Incidencia",
  ready: "Listo",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

const TRANSITIONS: Record<ItemStatus, ItemStatus[]> = {
  queued: ["preparing", "cancelled"],
  preparing: ["ready", "incident", "cancelled"],
  incident: ["preparing", "ready", "cancelled"],
  ready: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

const TRANSITION_ROLES: Record<string, Role[]> = {
  "queued:preparing": ["owner", "manager", "kitchen"],
  "queued:cancelled": ["owner", "manager"],
  "preparing:ready": ["owner", "manager", "kitchen"],
  "preparing:incident": ["owner", "manager", "kitchen"],
  "preparing:cancelled": ["owner", "manager"],
  "incident:preparing": ["owner", "manager", "kitchen"],
  "incident:ready": ["owner", "manager", "kitchen"],
  "incident:cancelled": ["owner", "manager"],
  "ready:delivered": ["owner", "manager", "waiter", "kitchen"],
  "ready:cancelled": ["owner", "manager"],
};

export function allowedTransitions(from: ItemStatus): ItemStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(
  from: ItemStatus,
  to: ItemStatus,
  role: Role,
): { ok: true } | { ok: false; reason: string } {
  if (from === to) {
    return { ok: false, reason: "El plato ya se encuentra en ese estado." };
  }
  if (!TRANSITIONS[from].includes(to)) {
    return {
      ok: false,
      reason: `No se puede pasar de «${STATUS_LABELS[from]}» a «${STATUS_LABELS[to]}».`,
    };
  }
  const roles = TRANSITION_ROLES[`${from}:${to}`] ?? [];
  if (!roles.includes(role)) {
    return {
      ok: false,
      reason: "Tu rol no permite realizar este cambio de estado.",
    };
  }
  return { ok: true };
}

export function nextActions(from: ItemStatus, role: Role): ItemStatus[] {
  return TRANSITIONS[from].filter((to) => canTransition(from, to, role).ok);
}
