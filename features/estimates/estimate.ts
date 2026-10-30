import type { ItemStatus } from "@/features/orders/state-machine";

export interface EstimateItem {
  id: string;
  stationId: string;
  status: ItemStatus;
  prepMinutes: number;
  queuedAt: Date | string;
  startedAt?: Date | string | null;
}

export interface StationSpec {
  id: string;
  capacity: number;
}

export interface StationBacklog {
  capacity: number;
  remainingMinutes: number;
  activeItems: number;
}

export interface EstimateInput {
  items: EstimateItem[];
  stations: StationSpec[];
  now?: Date;
  externalBacklog?: Record<string, StationBacklog>;
  prepOverrides?: Record<string, number>;
}

export interface StationEstimate {
  stationId: string;
  minutes: number;
  activeItems: number;
}

export interface EstimateResult {
  minMinutes: number;
  maxMinutes: number;
  readyAtMin: Date;
  readyAtMax: Date;
  source: "queue" | "history" | "done";
  stations: StationEstimate[];
  disclaimer: string;
}

const ACTIVE: ItemStatus[] = ["queued", "preparing", "incident"];
const DONE: ItemStatus[] = ["ready", "delivered", "cancelled"];

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function estimateOrder(input: EstimateInput): EstimateResult {
  const now = input.now ?? new Date();
  const stationSpecs = new Map(input.stations.map((s) => [s.id, s]));
  const overrides = input.prepOverrides ?? {};
  let usedHistory = false;

  const byStation = new Map<string, EstimateItem[]>();
  for (const item of input.items) {
    if (DONE.includes(item.status)) continue;
    const list = byStation.get(item.stationId) ?? [];
    list.push(item);
    byStation.set(item.stationId, list);
  }

  if (byStation.size === 0) {
    return {
      minMinutes: 0,
      maxMinutes: 0,
      readyAtMin: now,
      readyAtMax: now,
      source: "done",
      stations: [],
      disclaimer: "No quedan platos pendientes en esta comanda.",
    };
  }

  const stationEstimates: StationEstimate[] = [];
  let completion = now.getTime();

  for (const [stationId, items] of byStation) {
    const spec = stationSpecs.get(stationId);
    const capacity = Math.max(1, spec?.capacity ?? 1);
    const backlog = input.externalBacklog?.[stationId];
    const externalDelayMs = backlog
      ? Math.ceil(Math.max(0, backlog.remainingMinutes) / Math.max(1, backlog.capacity)) *
        60_000
      : 0;

    const slots = Array.from(
      { length: capacity },
      () => now.getTime() + externalDelayMs,
    );

    const ordered = [...items].sort(
      (a, b) => asDate(a.queuedAt).getTime() - asDate(b.queuedAt).getTime(),
    );

    let stationCompletion = now.getTime();

    for (const item of ordered) {
      if (item.status === "incident") {
        // Un plato en incidencia no avanza; se estima que se retomará en el
        // siguiente hueco libre con su tiempo base completo.
        const slotIndex = slots.indexOf(Math.min(...slots));
        const start = Math.max(now.getTime(), slots[slotIndex] ?? now.getTime());
        const end = start + Math.max(1, item.prepMinutes) * 60_000;
        slots[slotIndex] = end;
        stationCompletion = Math.max(stationCompletion, end);
        continue;
      }

      const override = overrides[item.id];
      const prep =
        override && override > 0 ? Math.round(override) : Math.max(1, item.prepMinutes);
      if (override && override > 0) usedHistory = true;

      if (item.status === "preparing") {
        const started = item.startedAt ? asDate(item.startedAt).getTime() : now.getTime();
        const elapsed = Math.max(0, (now.getTime() - started) / 60_000);
        const remaining = Math.max(1, Math.round(prep - elapsed));
        const end = now.getTime() + remaining * 60_000;
        const slotIndex = slots.indexOf(Math.min(...slots));
        slots[slotIndex] = Math.max(slots[slotIndex] ?? now.getTime(), end);
        stationCompletion = Math.max(stationCompletion, end);
        continue;
      }

      const slotIndex = slots.indexOf(Math.min(...slots));
      const start = Math.max(now.getTime(), slots[slotIndex] ?? now.getTime());
      const end = start + prep * 60_000;
      slots[slotIndex] = end;
      stationCompletion = Math.max(stationCompletion, end);
    }

    const minutes = Math.max(0, Math.ceil((stationCompletion - now.getTime()) / 60_000));
    stationEstimates.push({ stationId, minutes, activeItems: ordered.length });
    completion = Math.max(completion, stationCompletion);
  }

  const center = Math.max(1, Math.ceil((completion - now.getTime()) / 60_000));
  const minMinutes = Math.max(1, Math.floor(center * 0.85));
  const maxMinutes = Math.max(minMinutes + 2, Math.ceil(center * 1.25) + 1);

  return {
    minMinutes,
    maxMinutes,
    readyAtMin: new Date(now.getTime() + minMinutes * 60_000),
    readyAtMax: new Date(now.getTime() + maxMinutes * 60_000),
    source: usedHistory ? "history" : "queue",
    stations: stationEstimates,
    disclaimer:
      "Es una estimación orientativa basada en la carga actual de cocina; puede variar durante el servicio.",
  };
}

export function formatEstimate(result: EstimateResult): string {
  if (result.source === "done") return "Sin platos pendientes";
  if (result.minMinutes === result.maxMinutes) return `${result.minMinutes} min`;
  return `${result.minMinutes}–${result.maxMinutes} min`;
}

export function median(values: number[]): number | null {
  const clean = values
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const middle = Math.floor(clean.length / 2);
  if (clean.length % 2 === 1) return clean[middle] ?? null;
  return Math.round((((clean[middle - 1] ?? 0) + (clean[middle] ?? 0)) / 2) * 10) / 10;
}

export interface PrepSample {
  menuItemId: string;
  minutes: number;
}

export interface MedianResult {
  menuItemId: string;
  medianMinutes: number;
  samples: number;
}

/**
 * Mediana de tiempos reales por plato. No se devuelve ningún valor hasta
 * reunir `minSamples` muestras válidas: un dato aislado no es una predicción.
 */
export function historicalMedians(
  samples: PrepSample[],
  minSamples = 5,
): Map<string, MedianResult> {
  const groups = new Map<string, number[]>();
  for (const sample of samples) {
    if (!Number.isFinite(sample.minutes) || sample.minutes <= 0 || sample.minutes > 180) {
      continue;
    }
    const list = groups.get(sample.menuItemId) ?? [];
    list.push(sample.minutes);
    groups.set(sample.menuItemId, list);
  }

  const result = new Map<string, MedianResult>();
  for (const [menuItemId, values] of groups) {
    if (values.length < minSamples) continue;
    const value = median(values);
    if (value === null) continue;
    result.set(menuItemId, {
      menuItemId,
      medianMinutes: Math.round(value),
      samples: values.length,
    });
  }
  return result;
}
