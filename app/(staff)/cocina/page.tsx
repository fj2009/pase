import Link from "next/link";
import { AlertTriangle, Clock3, Flame, Settings2 } from "lucide-react";
import { ItemActions } from "@/components/staff/item-actions";
import { MessageFromQuery } from "@/components/ui/banner";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status";
import { requireCapability } from "@/features/auth/session";
import { getKitchenBoard, type KitchenOrder, type OrderItemView } from "@/features/orders/queries";
import type { ItemStatus } from "@/features/orders/state-machine";
import { can } from "@/features/permissions/capabilities";
import clsx from "clsx";
import { elapsedLabel, formatTime, minutesSince } from "@/lib/datetime";

export const metadata = { title: "Cocina · Pase" };

const PRIORITY: Record<ItemStatus, number> = {
  incident: 0,
  queued: 1,
  preparing: 2,
  ready: 3,
  delivered: 4,
  cancelled: 5,
};

interface Card {
  order: KitchenOrder;
  item: OrderItemView;
}

export default async function KitchenPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; estacion?: string }>;
}) {
  const params = await searchParams;
  const context = await requireCapability("workKitchen");
  const board = await getKitchenBoard(
    context.user.id,
    context.restaurant.restaurantId,
  );
  const timeZone = context.restaurant.timezone;
  const selected = board.stations.find((station) => station.id === params.estacion) ?? null;
  const returnTo = `/cocina${selected ? `?estacion=${selected.id}` : ""}`;

  const cards: Card[] = board.orders.flatMap((order) =>
    order.items.map((item) => ({ order, item })),
  );

  const byStation = new Map<string, Card[]>();
  for (const card of cards) {
    if (selected && card.item.stationId !== selected.id) continue;
    const list = byStation.get(card.item.stationId) ?? [];
    list.push(card);
    byStation.set(card.item.stationId, list);
  }
  for (const list of byStation.values()) {
    list.sort((a, b) => {
      const priority = PRIORITY[a.item.status] - PRIORITY[b.item.status];
      if (priority !== 0) return priority;
      return new Date(a.item.queuedAt).getTime() - new Date(b.item.queuedAt).getTime();
    });
  }

  const visibleStations = selected
    ? [selected]
    : board.stations.filter((station) => byStation.has(station.id));

  return (
    <div className="space-y-7">
      <MessageFromQuery value={params.ok ?? params.error} />
      <PageHeader
        kicker="Pase de cocina"
        title="Todo lo que está en marcha"
        description="Cada estación ve sus platos en orden de llegada. Las incidencias suben al principio de la cola y sala recibe el aviso al instante."
        actions={
          <>
            <Link href="/sala" className="btn-secondary btn-sm">
              Ver sala
            </Link>
            {can(context.role, "manageTables") ? (
              <Link href="/admin/estaciones" className="btn-ghost btn-sm">
                <Settings2 className="h-3.5 w-3.5" aria-hidden />
                Estaciones
              </Link>
            ) : null}
          </>
        }
      />

      <dl className="grid grid-cols-2 border-y border-line bg-paper-raised sm:grid-cols-5">
        {[
          { label: "En cola", value: board.stats.queued },
          { label: "Preparando", value: board.stats.preparing },
          { label: "Incidencias", value: board.stats.incident, alert: true },
          { label: "Listos", value: board.stats.ready, ok: true },
          { label: "Más antiguo", value: `${board.stats.oldestMinutes}′` },
        ].map((metric) => (
          <div
            key={metric.label}
            className="border-b border-line px-4 py-4 last:border-b-0 even:border-l sm:border-b-0 sm:border-r sm:last:border-r-0 sm:even:border-l-0"
          >
            <dt className="label">{metric.label}</dt>
            <dd
              className={clsx(
                "mt-2 font-display text-3xl leading-none tabular-nums",
                metric.alert && board.stats.incident > 0 && "text-danger",
                metric.ok && board.stats.ready > 0 && "text-ok",
              )}
            >
              {metric.value}
            </dd>
          </div>
        ))}
      </dl>

      {board.stats.incident > 0 ? (
        <div className="flex items-center gap-2 border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          Hay {board.stats.incident}{" "}
          {board.stats.incident === 1 ? "incidencia abierta" : "incidencias abiertas"}. Sala
          las ve en el seguimiento del pedido.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        <Link
          href="/cocina"
          className={clsx(
            "border px-3 py-1.5 text-xs",
            !selected
              ? "border-olive/30 bg-olive-soft text-olive-deep"
              : "border-line text-ink-soft hover:bg-paper-deep",
          )}
        >
          Todas las estaciones
        </Link>
        {board.stations.map((station) => (
          <Link
            key={station.id}
            href={`/cocina?estacion=${station.id}`}
            className={clsx(
              "border px-3 py-1.5 text-xs",
              selected?.id === station.id
                ? "border-olive/30 bg-olive-soft text-olive-deep"
                : "border-line text-ink-soft hover:bg-paper-deep",
            )}
          >
            {station.name}
            <span className="ml-1.5 font-mono text-[0.6rem] text-ink-faint">
              {(byStation.get(station.id) ?? []).length}
            </span>
          </Link>
        ))}
      </div>

      {visibleStations.length === 0 ? (
        <EmptyState
          title="No hay platos en el pase"
          description="Cuando sala envíe una comanda, los platos aparecerán aquí agrupados por estación y en orden de llegada."
          icon={<Flame className="h-5 w-5" strokeWidth={1.5} aria-hidden />}
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleStations.map((station) => {
            const stationCards = byStation.get(station.id) ?? [];
            return (
              <section key={station.id} className="min-w-0">
                <div className="mb-3 flex items-baseline justify-between border-b border-line pb-2">
                  <h2 className="font-display text-xl">{station.name}</h2>
                  <p className="meta-mono">
                    {stationCards.length} platos · cap. {station.capacity}
                  </p>
                </div>
                <ul className="space-y-2.5">
                  {stationCards.map(({ order, item }) => {
                    const age = minutesSince(item.startedAt ?? item.queuedAt);
                    return (
                      <li
                        key={item.id}
                        className={clsx(
                          "border bg-paper-raised p-3.5",
                          item.status === "incident"
                            ? "border-danger/40"
                            : item.status === "ready"
                              ? "border-ok/40 bg-ok-soft/40"
                              : item.status === "preparing"
                                ? "border-amber/35"
                                : "border-line",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="meta-mono">Mesa {order.tableLabel} · nº {order.number}</p>
                            <p className="mt-1 text-sm font-medium leading-tight">
                              <span className="mr-1.5 font-mono text-xs text-ink-faint">
                                {item.quantity}×
                              </span>
                              {item.name}
                            </p>
                          </div>
                          <StatusPill status={item.status} />
                        </div>

                        {item.notes ? (
                          <p className="mt-2 border-l-2 border-terracotta/40 pl-2 text-[0.7rem] leading-relaxed text-terracotta">
                            {item.notes}
                          </p>
                        ) : null}
                        {item.incidentNote ? (
                          <p className="mt-2 border-l-2 border-danger/40 pl-2 text-[0.7rem] leading-relaxed text-danger">
                            {item.incidentNote}
                          </p>
                        ) : null}

                        <div className="mt-2 flex items-center justify-between gap-2 text-[0.65rem] text-ink-faint">
                          <span className="flex items-center gap-1">
                            <Clock3 className="h-3 w-3" aria-hidden />
                            {elapsedLabel(item.startedAt ?? item.queuedAt)} ·{" "}
                            {formatTime(item.queuedAt, timeZone)}
                          </span>
                          <span
                            className={clsx(
                              "font-mono",
                              age >= 20 && item.status !== "ready" ? "text-danger" : "",
                            )}
                          >
                            {age}′
                          </span>
                        </div>

                        <div className="mt-3 border-t border-line/70 pt-2.5">
                          <ItemActions
                            itemId={item.id}
                            dishName={item.name}
                            status={item.status}
                            role={context.role}
                            returnTo={returnTo}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <p className="border-t border-line pt-4 text-[0.68rem] leading-relaxed text-ink-faint">
        Prioridad del pase: incidencia, en cola, en preparación, listo. Al marcar un
        plato como listo, sala lo ve al instante en el seguimiento y en la mesa.
      </p>
    </div>
  );
}
