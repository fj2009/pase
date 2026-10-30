import Link from "next/link";
import {
  ArrowUpRight,
  ChefHat,
  ClipboardList,
  CookingPot,
  ReceiptText,
  Users,
} from "lucide-react";
import { MessageFromQuery } from "@/components/ui/banner";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status";
import { requireCapability } from "@/features/auth/session";
import { getDashboard } from "@/features/orders/queries";
import { formatPrice } from "@/lib/money";
import { formatTime } from "@/lib/datetime";

export const metadata = { title: "Resumen · Pase" };

function Metric({
  label,
  value,
  hint,
  href,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  icon?: React.ReactNode;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <dt className="label">{label}</dt>
        <span className="text-ink-faint" aria-hidden>
          {icon}
        </span>
      </div>
      <dd className="mt-3 font-display text-4xl leading-none tracking-[-0.03em] tabular-nums">
        {value}
      </dd>
      {hint ? <p className="mt-2 text-xs text-ink-faint">{hint}</p> : null}
      {href ? (
        <span className="mt-3 inline-flex items-center gap-1 text-[0.7rem] font-medium text-olive">
          Abrir
          <ArrowUpRight className="h-3 w-3" aria-hidden />
        </span>
      ) : null}
    </>
  );

  return (
    <div className="border-b border-line px-5 py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      {href ? (
        <Link href={href} className="block hover:text-olive-deep">
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const context = await requireCapability("viewStats");
  const data = await getDashboard(context.user.id, context.restaurant.restaurantId);
  const { counts } = data;
  const firstName = context.user.fullName.split(" ")[0] ?? context.user.fullName;
  const timeZone = context.restaurant.timezone;

  return (
    <div className="space-y-8">
      <MessageFromQuery value={params.ok ?? params.error} />
      <PageHeader
        kicker="Resumen del servicio"
        title={`Hola, ${firstName}.`}
        description="Una lectura rápida de la sala, la cocina y la caja. Los datos se actualizan solos cuando cambia una comanda o una cuenta."
        actions={
          <>
            <Link href="/sala" className="btn-secondary btn-sm">
              Ir a sala
            </Link>
            <Link href="/cocina" className="btn-primary btn-sm">
              Pase de cocina
            </Link>
          </>
        }
      />

      {counts.menuItems === 0 ? (
        <div className="flex flex-col gap-4 border border-amber/30 bg-amber-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-amber">La carta pública está vacía</p>
            <p className="mt-1 text-xs leading-relaxed text-amber/80">
              Crea categorías y platos para que los clientes puedan pedir desde el QR
              de la mesa.
            </p>
          </div>
          <Link href="/admin/carta" className="btn-secondary btn-sm shrink-0">
            Preparar la carta
          </Link>
        </div>
      ) : null}

      <dl className="grid grid-cols-2 border-y border-line bg-paper-raised sm:grid-cols-4">
        <Metric
          label="Mesas abiertas"
          value={`${counts.openTables}/${counts.tables}`}
          hint={`${counts.activeOrders} comandas activas`}
          href="/sala"
          icon={<ClipboardList className="h-4 w-4" strokeWidth={1.6} />}
        />
        <Metric
          label="En cocina"
          value={counts.pendingItems}
          hint={counts.readyItems > 0 ? `${counts.readyItems} listos para servir` : "Sin platos listos"}
          href="/cocina"
          icon={<ChefHat className="h-4 w-4" strokeWidth={1.6} />}
        />
        <Metric
          label="Cuentas pedidas"
          value={counts.billRequests}
          hint={counts.billRequests > 0 ? "Requieren atención en sala" : "Nada pendiente"}
          href="/sala/cuentas"
          icon={<ReceiptText className="h-4 w-4" strokeWidth={1.6} />}
        />
        <Metric
          label="Tiempo medio"
          value={counts.averagePrepMinutes > 0 ? `${counts.averagePrepMinutes}′` : "—"}
          hint="Desde inicio hasta listo, 7 días"
          icon={<CookingPot className="h-4 w-4" strokeWidth={1.6} />}
        />
      </dl>

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <section>
          <SectionTitle
            index="01"
            title="Últimas comandas"
            description="El pulso reciente del servicio, con importe y hora."
            actions={
              <Link href="/sala" className="text-xs font-medium text-olive hover:underline">
                Ver sala
              </Link>
            }
          />
          {data.recentOrders.length === 0 ? (
            <EmptyState
              title="Todavía no hay comandas"
              description="Abre una mesa desde Sala y envía la primera comanda para empezar a medir el servicio."
              action={
                <Link href="/sala" className="btn-secondary btn-sm">
                  Abrir sala
                </Link>
              }
            />
          ) : (
            <div className="border border-line bg-paper-raised">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="label px-4 py-2.5 font-medium">Mesa</th>
                    <th className="label px-4 py-2.5 font-medium">Comanda</th>
                    <th className="label hidden px-4 py-2.5 font-medium sm:table-cell">
                      Hora
                    </th>
                    <th className="label px-4 py-2.5 text-right font-medium">Total</th>
                    <th className="w-8 px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {data.recentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-line last:border-b-0">
                      <td className="px-4 py-3">
                        <Link
                          href={`/sala/mesa/${order.tableId}`}
                          className="font-medium hover:underline"
                        >
                          {order.tableLabel}
                        </Link>
                        <span className="mt-0.5 block text-[0.7rem] text-ink-faint">
                          {order.items} platos
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={order.status} />
                        <span className="mt-1 block text-[0.7rem] text-ink-faint">
                          nº {order.number}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-ink-faint sm:table-cell">
                        {formatTime(order.createdAt, timeZone)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                        {formatPrice(order.totalCents)}
                      </td>
                      <td className="px-2 py-3 text-ink-faint">
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <SectionTitle index="02" title="Tiempos reales" description="Mediana por plato, últimos 30 días." />
          {data.medians.length === 0 ? (
            <p className="border border-dashed border-line-strong px-4 py-6 text-xs leading-relaxed text-ink-faint">
              Aún no hay suficientes platos terminados para calcular medianas. Se
              necesitan al menos tres muestras por plato.
            </p>
          ) : (
            <ul className="border border-line bg-paper-raised">
              {data.medians.map((row) => (
                <li
                  key={`${row.dish}-${row.station}`}
                  className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{row.dish}</p>
                    <p className="text-[0.68rem] text-ink-faint">
                      {row.station} · {row.samples} muestras
                    </p>
                  </div>
                  <span className="font-mono text-sm tabular-nums">{row.medianMinutes}′</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-7">
            <SectionTitle index="03" title="Equipo y carta" />
            <dl className="grid grid-cols-2 gap-4 border border-line bg-paper-raised p-4">
              <div>
                <dt className="label">Platos publicados</dt>
                <dd className="mt-1 font-mono text-xl">{counts.menuItems}</dd>
              </div>
              <div>
                <dt className="label">Personas</dt>
                <dd className="mt-1 flex items-center gap-1.5 font-mono text-xl">
                  {counts.staff}
                  <Users className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
                </dd>
              </div>
              <div className="col-span-2 border-t border-line pt-3">
                <Link href="/admin/carta" className="btn-secondary btn-sm w-full">
                  Editar carta
                </Link>
              </div>
            </dl>
          </div>
        </section>
      </div>

      <section>
        <SectionTitle
          index="04"
          title="Actividad reciente"
          description="Las últimas acciones registradas en auditoría."
          actions={
            <Link href="/admin/auditoria" className="text-xs font-medium text-olive hover:underline">
              Ver todo
            </Link>
          }
        />
        {data.recentAudit.length === 0 ? (
          <p className="text-xs text-ink-faint">Sin actividad registrada.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {data.recentAudit.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5 text-xs">
                <span className="font-mono text-[0.65rem] uppercase text-ink-faint">
                  {formatTime(entry.createdAt, timeZone)}
                </span>
                <span className="font-medium">{entry.action}</span>
                <span className="text-ink-faint">{entry.entity}</span>
                <span className="ml-auto text-ink-faint">{entry.actorLabel}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
