import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Clock, ReceiptText } from "lucide-react";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { StatusPill } from "@/components/ui/status";
import { getTracking, type TrackingItem } from "@/features/tracking/public";
import {
  estimateOrder,
  formatEstimate,
  type StationBacklog,
} from "@/features/estimates/estimate";
import { formatPrice } from "@/lib/money";
import { formatTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const data = await getTracking(token);
  return {
    title: data ? `Comanda ${data.order.number} · ${data.restaurant.name}` : "Seguimiento",
    robots: { index: false, follow: false },
  };
}

const STEPS: { key: string; label: string; description: string }[] = [
  { key: "received", label: "Recibida", description: "La comanda ha llegado a cocina." },
  { key: "cooking", label: "En cocina", description: "Los platos se están preparando." },
  { key: "ready", label: "Lista", description: "Todo listo para salir a sala." },
  { key: "served", label: "Servida", description: "Los platos están en la mesa." },
];

function stepIndex(items: TrackingItem[], closed: boolean): number {
  if (closed || (items.length > 0 && items.every((item) => item.status === "delivered" || item.status === "cancelled"))) {
    return 3;
  }
  if (items.length > 0 && items.every((item) => item.status === "ready" || item.status === "delivered" || item.status === "cancelled")) {
    return 2;
  }
  if (items.some((item) => item.status === "preparing" || item.status === "ready" || item.status === "incident")) {
    return 1;
  }
  return 0;
}

export default async function TrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getTracking(token);
  if (!data) notFound();

  const timeZone = data.restaurant.timezone;
  const activeItems = data.items.filter(
    (item) => item.status !== "delivered" && item.status !== "cancelled",
  );
  const backlog: Record<string, StationBacklog> = {};
  for (const [stationId, entry] of Object.entries(data.station_backlog)) {
    backlog[stationId] = {
      capacity: entry.capacity,
      activeItems: entry.active_items,
      remainingMinutes: entry.remaining_minutes,
    };
  }
  const estimate = estimateOrder({
    items: data.items.map((item) => ({
      id: item.id,
      stationId: item.station_id,
      status: item.status,
      prepMinutes: item.prep_minutes,
      queuedAt: item.queued_at,
      startedAt: item.started_at,
    })),
    stations: Object.entries(data.station_backlog).map(([id, entry]) => ({
      id,
      capacity: entry.capacity,
    })),
    externalBacklog: backlog,
  });
  const currentStep = stepIndex(data.items, data.order.status === "closed");
  const served = data.items.filter(
    (item) => item.status === "delivered" || item.status === "cancelled",
  ).length;

  return (
    <main id="contenido" className="min-h-screen bg-paper pb-20">
      <div className="border-b border-line bg-paper-raised">
        <div className="mx-auto max-w-2xl px-5 pb-9 pt-7 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link
              href={`/carta/${data.restaurant.slug}`}
              className="inline-flex items-center gap-1.5 text-xs text-ink-faint transition-colors hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Volver a la carta
            </Link>
            <p className="meta-mono">Seguimiento en directo</p>
          </div>

          <p className="label mt-8">Comanda {data.order.number}</p>
          <h1 className="mt-3 text-balance font-display text-5xl leading-[0.95] tracking-[-0.02em] sm:text-6xl">
            {data.restaurant.name}
          </h1>
          <p className="mt-4 text-sm text-ink-soft">
            {data.table.label}
            {data.table.zone ? ` · ${data.table.zone}` : ""} · realizada a las{" "}
            {formatTime(data.order.created_at, timeZone)}
          </p>

          <div className="mt-5">
            <RealtimeRefresh
              url={`/api/events/seguimiento/${encodeURIComponent(token)}`}
              showStatus
              label="Actualizándose en directo"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-5 sm:px-8">
        {data.order.expired ? (
          <div className="mt-8 border border-amber/40 bg-amber-soft px-4 py-3 text-sm text-amber">
            Este enlace de seguimiento ha caducado. La información que ves es la
            última disponible; pide al personal si necesitas una actualización.
          </div>
        ) : null}

        <section className="mt-8 border border-line bg-paper-raised">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <p className="label">Tiempo estimado</p>
              <p className="mt-1 font-display text-3xl tracking-[-0.01em]">
                {data.order.status === "closed"
                  ? "Comanda cerrada"
                  : activeItems.length === 0
                    ? "Lista para servir"
                    : formatEstimate(estimate)}
              </p>
            </div>
            <StatusPill status={data.order.status} />
          </div>

          {activeItems.length > 0 && data.order.status === "open" && !data.order.expired ? (
            <p className="flex items-start gap-2 px-5 py-3 text-xs leading-relaxed text-ink-soft">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden />
              <span>
                Previsión entre {formatTime(estimate.readyAtMin, timeZone)} y{" "}
                {formatTime(estimate.readyAtMax, timeZone)}. {estimate.disclaimer}
              </span>
            </p>
          ) : (
            <p className="flex items-start gap-2 px-5 py-3 text-xs leading-relaxed text-ink-soft">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" aria-hidden />
              <span>{estimate.disclaimer}</span>
            </p>
          )}
        </section>

        <section aria-labelledby="estado" className="mt-8">
          <h2 id="estado" className="label mb-3">
            Estado del servicio
          </h2>
          <ol className="border border-line bg-paper-raised">
            {STEPS.map((step, index) => {
              const done = index < currentStep;
              const current = index === currentStep;
              return (
                <li
                  key={step.key}
                  className="flex gap-4 border-b border-line px-5 py-4 last:border-b-0"
                >
                  <span
                    className={
                      done
                        ? "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-ok bg-ok text-paper-raised"
                        : current
                          ? "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-amber bg-amber-soft text-amber"
                          : "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-line-strong text-[0.65rem] text-ink-faint"
                    }
                    aria-hidden
                  >
                    {done ? <Check className="h-3 w-3" /> : current ? <span className="h-1.5 w-1.5 rounded-full bg-amber" /> : index + 1}
                  </span>
                  <div>
                    <p className={current ? "text-sm font-semibold text-ink" : "text-sm text-ink-soft"}>
                      {step.label}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-faint">{step.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby="platos" className="mt-8">
          <div className="mb-3 flex items-end justify-between gap-4">
            <h2 id="platos" className="label">
              Platos
            </h2>
            <span className="meta-mono">
              {served}/{data.items.length} servidos
            </span>
          </div>

          <ul className="border border-line bg-paper-raised">
            {data.items.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="meta-mono mr-2 text-ink-faint">{item.quantity}×</span>
                    {item.name}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {item.status === "ready"
                      ? `Listo a las ${formatTime(item.ready_at ?? item.queued_at, timeZone)}`
                      : item.status === "delivered"
                        ? `Servido a las ${formatTime(item.delivered_at ?? item.ready_at ?? item.queued_at, timeZone)}`
                        : item.status === "cancelled"
                          ? "Cancelado por el equipo"
                          : `Pedido a las ${formatTime(item.queued_at, timeZone)} · ${item.prep_minutes} min aprox.`}
                  </p>
                </div>
                <StatusPill status={item.status} />
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8 flex items-center justify-between border border-line bg-paper-deep px-5 py-4">
          <div className="flex items-center gap-2 text-sm text-ink-soft">
            <ReceiptText className="h-4 w-4 text-ink-faint" aria-hidden />
            Total de la comanda
          </div>
          <p className="font-display text-2xl tracking-[-0.01em]">
            {formatPrice(data.order.total_cents)}
          </p>
        </section>

        <p className="mt-6 text-center text-xs leading-relaxed text-ink-faint">
          Esta página solo muestra tu comanda. No se comparten datos de otras
          mesas ni la carga interna de cada estación.
        </p>
      </div>
    </main>
  );
}
