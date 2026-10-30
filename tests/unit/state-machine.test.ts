import { describe, expect, it } from "vitest";
import {
  allowedTransitions,
  canTransition,
  nextActions,
  STATUS_LABELS,
} from "@/features/orders/state-machine";

describe("transiciones de platos", () => {
  it("permite a cocina empezar y terminar un plato", () => {
    expect(canTransition("queued", "preparing", "kitchen")).toEqual({ ok: true });
    expect(canTransition("preparing", "ready", "kitchen")).toEqual({ ok: true });
  });

  it("impide a sala empezar un plato", () => {
    const result = canTransition("queued", "preparing", "waiter");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("rol");
  });

  it("impide cancelar a cocina", () => {
    expect(canTransition("queued", "cancelled", "kitchen").ok).toBe(false);
    expect(canTransition("queued", "cancelled", "manager").ok).toBe(true);
  });

  it("bloquea saltos de estado no permitidos", () => {
    const result = canTransition("queued", "delivered", "owner");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("En cola");
  });

  it("no permite repetir el mismo estado", () => {
    expect(canTransition("ready", "ready", "owner").ok).toBe(false);
  });

  it("ofrece solo las acciones válidas para el rol", () => {
    expect(nextActions("preparing", "kitchen")).toEqual(["ready", "incident"]);
    expect(nextActions("delivered", "owner")).toEqual([]);
    expect(allowedTransitions("ready")).toEqual(["delivered", "cancelled"]);
  });

  it("mantiene etiquetas en castellano para todos los estados", () => {
    expect(STATUS_LABELS.queued).toBe("En cola");
    expect(STATUS_LABELS.preparing).toBe("En preparación");
  });
});
