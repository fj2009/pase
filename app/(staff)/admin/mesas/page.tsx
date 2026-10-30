import Link from "next/link";
import {
  Armchair,
  ArrowUpRight,
  Download,
  MapPin,
  Pencil,
  Plus,
  QrCode,
} from "lucide-react";
import { MessageFromQuery } from "@/components/ui/banner";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status";
import { requireCapability } from "@/features/auth/session";
import { getTablesAdmin } from "@/features/tables/admin";

export const metadata = { title: "Mesas y QR · Pase" };

export default async function AdminTablesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const context = await requireCapability("manageTables");
  const tables = await getTablesAdmin(
    context.user.id,
    context.restaurant.restaurantId,
  );

  const activeTables = tables.filter((table) => table.isActive);
  const seats = activeTables.reduce((total, table) => total + table.seats, 0);
  const zones = new Map<string, typeof tables>();
  for (const table of tables) {
    const key = table.zone ?? "Sin zona";
    const list = zones.get(key) ?? [];
    list.push(table);
    zones.set(key, list);
  }

  return (
    <div className="space-y-8">
      <MessageFromQuery value={params.ok ?? params.error} />
      <PageHeader
        kicker="Sala"
        title="Mesas y códigos QR"
        description="Cada mesa tiene un QR único que abre la carta con su servicio. Descárgalo en PNG para imprimirlo o colócalo en el atril."
        actions={
          <Link href="/admin/mesas/nueva" className="btn-primary btn-sm">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Nueva mesa
          </Link>
        }
      />

      <dl className="grid grid-cols-3 border-y border-line bg-paper-raised">
        <div className="border-r border-line px-5 py-4">
          <dt className="label">Mesas activas</dt>
          <dd className="mt-2 font-display text-3xl leading-none tabular-nums">
            {activeTables.length}
          </dd>
        </div>
        <div className="border-r border-line px-5 py-4">
          <dt className="label">Zonas</dt>
          <dd className="mt-2 font-display text-3xl leading-none tabular-nums">
            {zones.size}
          </dd>
        </div>
        <div className="px-5 py-4">
          <dt className="label">Comensales</dt>
          <dd className="mt-2 font-display text-3xl leading-none tabular-nums">
            {seats}
          </dd>
        </div>
      </dl>

      {tables.length === 0 ? (
        <EmptyState
          title="Todavía no hay mesas"
          description="Crea las mesas de sala, terraza o barra. Cada una recibe un QR y un enlace estable para pedir."
          icon={<Armchair className="h-5 w-5" strokeWidth={1.5} />}
          action={
            <Link href="/admin/mesas/nueva" className="btn-primary btn-sm">
              Crear la primera mesa
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          {[...zones.entries()].map(([zone, zoneTables]) => (
            <section key={zone}>
              <div className="mb-3 flex items-center gap-2 border-b border-line pb-2">
                <MapPin className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
                <h2 className="text-sm font-semibold">{zone}</h2>
                <span className="meta-mono">{zoneTables.length}</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {zoneTables.map((table) => (
                  <article
                    key={table.id}
                    className="panel flex gap-4 p-4"
                  >
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center border border-line bg-white">
                      <img
                        src={`/api/admin/mesas/${table.id}/qr`}
                        alt={`Código QR de ${table.label}`}
                        width={96}
                        height={96}
                        className="h-full w-full"
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold">{table.label}</h3>
                          <p className="mt-0.5 text-xs text-ink-faint">
                            {table.seats} comensales
                          </p>
                        </div>
                        {table.isActive ? (
                          table.sessionId ? (
                            <StatusPill status="open" label="En servicio" />
                          ) : (
                            <StatusPill status="active" label="Libre" />
                          )
                        ) : (
                          <StatusPill status="closed" label="Inactiva" />
                        )}
                      </div>

                      <div className="mt-auto flex flex-wrap items-center gap-1 pt-3">
                        <Link
                          href={`/admin/mesas/${table.id}`}
                          className="btn-ghost btn-sm px-2"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          Editar
                        </Link>
                        <a
                          href={`/api/admin/mesas/${table.id}/qr?format=png&download=1`}
                          className="btn-ghost btn-sm px-2"
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden />
                          PNG
                        </a>
                        {table.sessionId ? (
                          <Link
                            href={`/sala/mesa/${table.id}`}
                            className="btn-ghost btn-sm px-2 text-olive"
                          >
                            Abrir mesa
                            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                          </Link>
                        ) : (
                          <a
                            href={`/api/admin/mesas/${table.id}/qr`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-ghost btn-sm px-2"
                          >
                            <QrCode className="h-3.5 w-3.5" aria-hidden />
                            QR
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
