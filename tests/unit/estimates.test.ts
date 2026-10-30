import { describe, expect, it } from "vitest";
import {
  estimateOrder,
  formatEstimate,
  historicalMedians,
  median,
  type EstimateItem,
} from "@/features/estimates/estimate";

const now = new Date("2026-10-29T12:00:00.000Z");

function item(overrides: Partial<EstimateItem>): EstimateItem {
  return {
    id: crypto.randomUUID(),
    stationId: "cocina",
    status: "queued",
    prepMinutes: 10,
    queuedAt: now,
    ...overrides,
  };
}

describe("estimateOrder", () => {
  it("estima un plato en cola con capacidad uno", () => {
    const result = estimateOrder({
      items: [item({ prepMinutes: 10 })],
      stations: [{ id: "cocina", capacity: 1 }],
      now,
    });

    expect(result.source).toBe("queue");
    expect(result.minMinutes).toBeGreaterThanOrEqual(8);
    expect(result.maxMinutes).toBeGreaterThan(result.minMinutes);
    expect(result.readyAtMin.getTime()).toBeGreaterThan(now.getTime());
    expect(result.stations).toEqual([
      { stationId: "cocina", minutes: 10, activeItems: 1 },
    ]);
  });

  it("serializa los platos cuando la estación tiene una sola plaza", () => {
    const result = estimateOrder({
      items: [
        item({ prepMinutes: 10, queuedAt: new Date(now.getTime() - 60_000) }),
        item({ prepMinutes: 5 }),
      ],
      stations: [{ id: "cocina", capacity: 1 }],
      now,
    });

    expect(result.stations[0]?.minutes).toBe(15);
  });

  it("reparte en paralelo según la capacidad de la estación", () => {
    const result = estimateOrder({
      items: [item({ prepMinutes: 10 }), item({ prepMinutes: 10 })],
      stations: [{ id: "cocina", capacity: 2 }],
      now,
    });

    expect(result.stations[0]?.minutes).toBe(10);
  });

  it("descuenta el tiempo ya transcurrido de un plato en preparación", () => {
    const result = estimateOrder({
      items: [
        item({
          status: "preparing",
          prepMinutes: 12,
          startedAt: new Date(now.getTime() - 5 * 60_000),
        }),
      ],
      stations: [{ id: "cocina", capacity: 1 }],
      now,
    });

    expect(result.stations[0]?.minutes).toBe(7);
  });

  it("no deja que un plato en preparación termine antes de un minuto", () => {
    const result = estimateOrder({
      items: [
        item({
          status: "preparing",
          prepMinutes: 4,
          startedAt: new Date(now.getTime() - 30 * 60_000),
        }),
      ],
      stations: [{ id: "cocina", capacity: 1 }],
      now,
    });

    expect(result.stations[0]?.minutes).toBe(1);
  });

  it("vuelve a encolar una incidencia con su tiempo completo", () => {
    const result = estimateOrder({
      items: [item({ status: "incident", prepMinutes: 8 })],
      stations: [{ id: "cocina", capacity: 1 }],
      now,
    });

    expect(result.stations[0]?.minutes).toBe(8);
  });

  it("suma la cola externa de otras mesas sin mezclarla con la comanda", () => {
    const result = estimateOrder({
      items: [item({ prepMinutes: 5 })],
      stations: [{ id: "cocina", capacity: 2 }],
      externalBacklog: {
        cocina: { capacity: 2, remainingMinutes: 20, activeItems: 4 },
      },
      now,
    });

    expect(result.stations[0]?.minutes).toBe(15);
  });

  it("marca como terminada una comanda sin platos pendientes", () => {
    const result = estimateOrder({
      items: [
        item({ status: "delivered" }),
        item({ status: "cancelled" }),
      ],
      stations: [{ id: "cocina", capacity: 1 }],
      now,
    });

    expect(result.source).toBe("done");
    expect(result.minMinutes).toBe(0);
    expect(formatEstimate(result)).toBe("Sin platos pendientes");
  });

  it("usa la mediana histórica cuando existe una muestra suficiente", () => {
    const target = item({ prepMinutes: 10 });
    const result = estimateOrder({
      items: [target],
      stations: [{ id: "cocina", capacity: 1 }],
      prepOverrides: { [target.id]: 18 },
      now,
    });

    expect(result.source).toBe("history");
    expect(result.stations[0]?.minutes).toBe(18);
  });

  it("formatea un rango legible", () => {
    const result = estimateOrder({
      items: [item({ prepMinutes: 20 })],
      stations: [{ id: "cocina", capacity: 1 }],
      now,
    });

    expect(formatEstimate(result)).toMatch(/^\d+–\d+ min$/);
  });
});

describe("median e historicalMedians", () => {
  it("calcula la mediana con número par e impar de muestras", () => {
    expect(median([1, 3, 2])).toBe(2);
    expect(median([1, 2, 3, 10])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it("ignora muestras fuera de rango y no publica con menos de cinco", () => {
    const samples = [10, 11, 12, 13, 14, 0, -2, 500].map((minutes) => ({
      menuItemId: "croquetas",
      minutes,
    }));
    const result = historicalMedians(samples, 5);
    expect(result.get("croquetas")?.medianMinutes).toBe(12);
    expect(result.get("croquetas")?.samples).toBe(5);

    const few = historicalMedians(samples.slice(0, 4), 5);
    expect(few.size).toBe(0);
  });
});
