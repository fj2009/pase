import { describe, expect, it } from "vitest";
import { can, canAny, ROLE_LABELS, ROLE_ORDER } from "@/features/permissions/capabilities";

describe("capacidades por rol", () => {
  it("solo el propietario gestiona equipo y suscripción", () => {
    expect(can("owner", "manageStaff")).toBe(true);
    expect(can("manager", "manageStaff")).toBe(false);
    expect(can("owner", "manageSubscription")).toBe(true);
    expect(can("manager", "manageSubscription")).toBe(false);
  });

  it("sala puede tomar comandas y reimprimir, pero no tocar la carta", () => {
    expect(can("waiter", "takeOrders")).toBe(true);
    expect(can("waiter", "reprintTickets")).toBe(true);
    expect(can("waiter", "manageMenu")).toBe(false);
  });

  it("cocina no gestiona mesas ni estadísticas", () => {
    expect(can("kitchen", "workKitchen")).toBe(true);
    expect(can("kitchen", "manageTables")).toBe(false);
    expect(can("kitchen", "viewStats")).toBe(false);
  });

  it("canAny agrega varias capacidades", () => {
    expect(canAny("waiter", ["manageMenu", "takeOrders"])).toBe(true);
    expect(canAny("kitchen", ["manageMenu", "viewStats"])).toBe(false);
  });

  it("define etiquetas para todos los roles", () => {
    for (const role of ROLE_ORDER) expect(ROLE_LABELS[role]).toBeTruthy();
  });
});
