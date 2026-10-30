import Link from "next/link";
import { BarChart3, Clock3, TrendingUp, Utensils } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requireCapability } from "@/features/auth/session";
import { getStats } from "@/features/orders/queries";
import { formatPrice } from "@/lib/money";

export const metadata = { title: "Estadísticas · Pase" };

function Bar({
  value,
  max,
  label,
  detail,
}: {
  value: number;
  max: number;
  label: string;
  detail: string;
}) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="group flex items-center gap-3">
      <span className="w-14 shrink-0 text-right font-mono text-[0.65rem] text-ink-faint">
        {label}
      </span>
      <div className="h-5 flex-1 bg-paper-deep">
        <div
          className="h-full bg-olive/70 transition-colors group-hover:bg-olive"
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="w-20 shrink-0 text-right font-mono text-[0.68rem] text-ink-soft">
        {detail}
      </span>
    </div>
  );
}

export default async function AdminStatsPage() {
  const context = await requireCapability("viewStats");
  const stats = await getStats(context.user.id, context.restaurant.restaurantId);
  const { summary } = stats;
  const maxDaily = Math.max(...stats.daily.map((day) => day.revenueCents), 1);
  const maxHour = Math.max(...stats.hours.map((hour) => hour.orders), 1);

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Últimos 30 días"
        title="Cómo va el servicio."
        description="Datos reales de comandas y tiempos de cocina. La mediana evita que un ticket excepcional distorsione la lectura."
        actions={
          <Link href="/admin/auditoria" className="btn-secondary btn-sm">
            Ver auditoría
          </Link>
        }
      />

      <dl className="grid grid-cols-2 border-y border-line bg-paper-raised sm:grid-cols-4">
        {[
          {
            label: "Facturación",
            value: formatPrice(summary.revenueCents),
            hint: `${summary.orders} comandas`,
            icon: <TrendingUp className="h-4 w-4" strokeWidth={1.6} />,
          },
          {
            label: "Ticket medio",
            value: formatPrice(summary.averageTicketCents),
            hint: "por comanda",
            icon: <BarChart3 className="h-4 w-4" strokeWidth={1.6} />,
          },
          {
            label: "Platos",
            value: summary.dishes,
            hint: "sin cancelaciones",
            icon: <Utensils className="h-4 w-4" strokeWidth={1.6} />,
          },
          {
            label: "Tiempo medio",
            value: summary.averagePrepMinutes > 0 ? `${summary.averagePrepMinutes}′` : "—",
            hint: "inicio → listo",
            icon: <Clock3 className="h-4 w-4" strokeWidth={1.6} />,
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="border-b border-line px-5 py-5 last:border-b-0 even:border-l sm:border-b-0 sm:border-r sm:last:border-r-0 sm:even:border-l-0"
          >
            <div className="flex items-center justify-between gap-2">
              <dt className="label">{metric.label}</dt>
              <span className="text-ink-faint" aria-hidden>
                {metric.icon}
              </span>
            </div>
            <dd className="mt-3 font-display text-3xl leading-none tracking-[-0.03em] tabular-nums">
              {metric.value}
            </dd>
            <p className="mt-2 text-xs text-ink-faint">{metric.hint}</p>
          </div>
        ))}
      </dl>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3 border-b border-line pb-2">
          <h2 className="text-sm font-semibold">Facturación por día</h2>
          <span className="meta-mono">14 días</span>
        </div>
        <div className="space-y-1.5">
          {stats.daily.map((day) => (
            <Bar
              key={day.date}
              value={day.revenueCents}
              max={maxDaily}
              label={day.date.slice(5).replace("-", "/")}
              detail={formatPrice(day.revenueCents)}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <div className="mb-4 border-b border-line pb-2">
            <h2 className="text-sm font-semibold">Carga por estación</h2>
          </div>
          {stats.stations.length === 0 ? (
            <p className="border border-dashed border-line-strong px-4 py-6 text-sm text-ink-faint">
              Todavía no hay platos preparados en este periodo.
            </p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="text-[0.65rem] uppercase tracking-[0.08em] text-ink-faint">
                <tr>
                  <th className="py-2 font-medium">Estación</th>
                  <th className="py-2 text-right font-medium">Platos</th>
                  <th className="py-2 text-right font-medium">Mediana</th>
                  <th className="py-2 text-right font-medium">Muestras</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line border-y border-line">
                {stats.stations.map((station) => (
                  <tr key={station.station}>
                    <td className="py-2.5">{station.station}</td>
                    <td className="py-2.5 text-right tabular-nums">{station.dishes}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      {station.medianMinutes > 0 ? `${station.medianMinutes}′` : "—"}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-ink-faint">
                      {station.samples}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <div className="mb-4 border-b border-line pb-2">
            <h2 className="text-sm font-semibold">Comandas por hora</h2>
          </div>
          {stats.hours.length === 0 ? (
            <p className="border border-dashed border-line-strong px-4 py-6 text-sm text-ink-faint">
              Sin comandas en el periodo.
            </p>
          ) : (
            <div className="space-y-1.5">
              {stats.hours.map((hour) => (
                <Bar
                  key={hour.hour}
                  value={hour.orders}
                  max={maxHour}
                  label={`${String(hour.hour).padStart(2, "0")}:00`}
                  detail={`${hour.orders} com.`}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
