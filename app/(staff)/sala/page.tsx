import Link from "next/link";
import { ArrowUpRight, Clock3, ReceiptText } from "lucide-react";
import { MessageFromQuery } from "@/components/ui/banner";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireCapability } from "@/features/auth/session";
import { getSalaOverview, type SalaTable } from "@/features/orders/queries";
import { can } from "@/features/permissions/capabilities";
import { elapsedLabel, formatTime } from "@/lib/datetime";
import { formatPrice } from "@/lib/money";
import clsx from "clsx";

export const metadata = { title: "Sala · Pase" };

function TableCard({ table, timeZone }: { table: SalaTable; timeZone: string }) {
  const open = Boolean(table.sessionId);
  const bill = table.billStatus;
  const ready = table.readyItems > 0;

  return (
    <Link
      href={`/sala/mesa/${table.id}`}
      className={clsx(
        "group relative flex min-h-[158px] flex-col justify-between border p-4 transition-colors",
        !open
          ? "border-dashed border-line-strong bg-paper/30 hover:border-olive hover:bg-paper-raised"
          : bill
            ? "border-terracotta/40 bg-terracotta-soft/60 hover:bg-terracotta-soft"
            : ready
              ? "border-ok/40 bg-ok-soft/50 hover:bg-ok-soft"
              : "border-line bg-paper-raised hover:border-line-strong",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="label">Mesa</p>
          <p className="mt-1 font-display text-4xl leading-none tracking-[-0.03em]">
            {table.label}
          </p>
        </div>
        <span
          className={clsx(
            "border px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-[0.1em]",
            !open
              ? "border-line-strong text-ink-faint"
              : bill
                ? "border-terracotta/40 text-terracotta"
                : ready
                  ? "border-ok/40 text-ok"
                  : "border-line-strong text-ink-soft",
          )}
        >
          {!open ? "Libre" : bill ? "Cuenta" : ready ? "Listo" : "Ocupada"}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {open ? (
            <>
              <p className="text-xs text-ink-soft">
                {table.orders} {table.orders === 1 ? "comanda" : "comandas"}
                {table.pendingItems > 0 ? ` · ${table.pendingItems} en cocina` : ""}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[0.68rem] text-ink-faint">
                <Clock3 className="h-3 w-3" aria-hidden />
                {table.openedAt ? elapsedLabel(table.openedAt) : ""} ·{" "}
                {formatTime(table.openedAt ?? new Date().toISOString(), timeZone)}
              </p>
            </>
          ) : (
            <p className="text-xs text-ink-faint">
              {table.zone ?? "Sala"} · {table.seats} plazas
            </p>
          )}
        </div>
        {open ? (
          <div className="text-right">
            <p className="font-mono text-sm tabular-nums">{formatPrice(table.totalCents)}</p>
            <ArrowUpRight
              className="ml-auto mt-1 h-3.5 w-3.5 text-ink-faint transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden
            />
          </div>
        ) : null}
      </div>
    </Link>
  );
}

export default async function SalaPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const context = await requireCapability("manageService");
  const overview = await getSalaOverview(
    context.user.id,
    context.restaurant.restaurantId,
  );
  const timeZone = context.restaurant.timezone;

  const zones = new Map<string, SalaTable[]>();
  for (const table of overview.tables) {
    const key = table.zone ?? "Sin zona";
    const list = zones.get(key) ?? [];
    list.push(table);
    zones.set(key, list);
  }

  return (
    <div className="space-y-7">
      <MessageFromQuery value={params.ok ?? params.error} />
      <PageHeader
        kicker="Sala"
        title="Mesas y servicio"
        description="Abre mesas, toma comandas y sigue el estado de cada plato. Los cambios de cocina aparecen sin recargar."
        actions={
          <>
            <Link href="/sala/cuentas" className="btn-secondary btn-sm">
              <ReceiptText className="h-3.5 w-3.5" aria-hidden />
              Cuentas
              {overview.stats.billRequests > 0 ? (
                <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center bg-terracotta px-1 font-mono text-[0.6rem] text-paper">
                  {overview.stats.billRequests}
                </span>
              ) : null}
            </Link>
            {can(context.role, "workKitchen") ? (
              <Link href="/cocina" className="btn-primary btn-sm">
                Ver cocina
              </Link>
            ) : null}
          </>
        }
      />

      <dl className="grid grid-cols-2 border-y border-line bg-paper-raised sm:grid-cols-4">
        {[
          {
            label: "Mesas abiertas",
            value: `${overview.stats.openTables}/${overview.tables.length}`,
          },
          { label: "Comandas activas", value: overview.stats.activeOrders },
          { label: "Platos en cocina", value: overview.stats.pendingItems },
          { label: "Listos para servir", value: overview.stats.readyItems },
        ].map((metric) => (
          <div
            key={metric.label}
            className="border-b border-line px-4 py-4 last:border-b-0 even:border-l sm:border-b-0 sm:border-r sm:last:border-r-0 sm:even:border-l-0"
          >
            <dt className="label">{metric.label}</dt>
            <dd className="mt-2 font-display text-3xl leading-none tabular-nums">
              {metric.value}
            </dd>
          </div>
        ))}
      </dl>

      {overview.bills.length > 0 ? (
        <section className="border border-terracotta/30 bg-terracotta-soft/60">
          <div className="flex items-center justify-between gap-3 border-b border-terracotta/25 px-4 py-2.5">
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-terracotta">
              Cuentas solicitadas
            </p>
            <Link
              href="/sala/cuentas"
              className="text-[0.7rem] font-medium text-terracotta underline underline-offset-4"
            >
              Gestionar
            </Link>
          </div>
          <ul className="divide-y divide-terracotta/20">
            {overview.bills.map((bill) => (
              <li
                key={bill.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-xs"
              >
                <span className="font-medium">Mesa {bill.tableLabel}</span>
                <span className="text-terracotta/80">
                  {bill.status === "attending" ? "En curso" : "Solicitada"} a las{" "}
                  {formatTime(bill.requestedAt, timeZone)}
                </span>
                <span className="ml-auto font-mono tabular-nums">
                  {formatPrice(bill.totalCents)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {overview.tables.length === 0 ? (
        <EmptyState
          title="No hay mesas configuradas"
          description="Crea las mesas del restaurante y descarga sus códigos QR desde Gestión → Mesas y QR."
          action={
            can(context.role, "manageTables") ? (
              <Link href="/admin/mesas" className="btn-secondary btn-sm">
                Configurar mesas
              </Link>
            ) : null
          }
        />
      ) : (
        <div className="space-y-8">
          {[...zones.entries()].map(([zone, tables]) => (
            <section key={zone}>
              <div className="mb-3 flex items-baseline justify-between border-b border-line pb-2">
                <h2 className="font-display text-xl">{zone}</h2>
                <p className="meta-mono">
                  {tables.filter((table) => table.sessionId).length} de {tables.length} abiertas
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {tables.map((table) => (
                  <TableCard key={table.id} table={table} timeZone={timeZone} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
