export type Role = "owner" | "manager" | "waiter" | "kitchen";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Propietario",
  manager: "Encargado",
  waiter: "Sala",
  kitchen: "Cocina",
};

export const ROLE_ORDER: Role[] = ["owner", "manager", "waiter", "kitchen"];

export type Capability =
  | "manageMenu"
  | "manageTables"
  | "manageStaff"
  | "takeOrders"
  | "manageService"
  | "workKitchen"
  | "cancelItems"
  | "managePrinters"
  | "reprintTickets"
  | "viewStats"
  | "viewAudit"
  | "manageSubscription";

const CAPABILITIES: Record<Capability, Role[]> = {
  manageMenu: ["owner", "manager"],
  manageTables: ["owner", "manager"],
  manageStaff: ["owner"],
  takeOrders: ["owner", "manager", "waiter"],
  manageService: ["owner", "manager", "waiter"],
  workKitchen: ["owner", "manager", "kitchen"],
  cancelItems: ["owner", "manager"],
  managePrinters: ["owner", "manager"],
  reprintTickets: ["owner", "manager", "waiter"],
  viewStats: ["owner", "manager"],
  viewAudit: ["owner", "manager"],
  manageSubscription: ["owner"],
};

export function can(role: Role, capability: Capability): boolean {
  return CAPABILITIES[capability].includes(role);
}

export function canAny(role: Role, capabilities: Capability[]): boolean {
  return capabilities.some((capability) => can(role, capability));
}
