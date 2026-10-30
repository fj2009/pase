import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  QrCode,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { TableForm } from "@/components/admin/table-form";
import { MessageFromQuery } from "@/components/ui/banner";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status";
import { requireCapability } from "@/features/auth/session";
import {
  deleteTableAction,
  regenerateTableQrAction,
  saveTableAction,
} from "@/features/tables/actions";
import { getTableAdmin, getTablesAdmin } from "@/features/tables/admin";
import { formatTime } from "@/lib/datetime";
import { env } from "@/lib/env";

export const metadata = { title: "Editar mesa · Pase" };

export default async function EditTablePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const context = await requireCapability("manageTables");
  const [table, tables] = await Promise.all([
    getTableAdmin(context.user.id, context.restaurant.restaurantId, id),
    getTablesAdmin(context.user.id, context.restaurant.restaurantId),
  ]);
  if (!table) notFound();

  const zones = [
    ...new Set(tables.map((entry) => entry.zone).filter((zone): zone is string => Boolean(zone))),
  ].sort();
  const menuUrl = `${env.SITE_URL}/carta/${context.restaurant.slug}?mesa=${table.qrToken}`;

  return (
    <div className="space-y-8">
      <MessageFromQuery value={query.ok ?? query.error} />
      <PageHeader
        kicker="Sala"
        title={table.label}
        description={`${table.zone ?? "Sin zona"} · ${table.seats} comensales`}
        actions={
          <>
            <Link href="/admin/mesas" className="btn-secondary btn-sm">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Volver a mesas
            </Link>
            {table.sessionId ? (
              <Link href={`/sala/mesa/${table.id}`} className="btn-primary btn-sm">
                Abrir mesa
              </Link>
            ) : null}
          </>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="panel p-5 sm:p-6">
            <TableForm
              action={saveTableAction}
              table={table}
              returnTo={`/admin/mesas/${table.id}`}
              zones={zones}
            />
          </div>

          <section className="border border-danger/25 bg-danger-soft/40 p-5">
            <p className="label text-danger">Zona delicada</p>
            {table.sessionId ? (
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Hay un servicio abierto desde las{" "}
                {table.sessionOpenedAt
                  ? formatTime(table.sessionOpenedAt, context.restaurant.timezone)
                  : "—"}
                . Ciérralo desde sala antes de eliminar la mesa.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Si la mesa tiene historial se desactivará para conservar las
                  comandas. Si nunca se ha usado, se borrará.
                </p>
                <ConfirmForm
                  action={deleteTableAction}
                  message={`¿Eliminar «${table.label}»? El QR dejará de funcionar.`}
                  confirmLabel="Eliminar mesa"
                  className="mt-4"
                  trigger={
                    <>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Eliminar mesa
                    </>
                  }
                >
                  <input type="hidden" name="id" value={table.id} />
                </ConfirmForm>
              </>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="panel p-5">
            <div className="flex items-center justify-between">
              <p className="label">Código QR</p>
              {table.isActive ? (
                <StatusPill status="active" label="Activa" />
              ) : (
                <StatusPill status="closed" label="Inactiva" />
              )}
            </div>
            <div className="mt-4 border border-line bg-white p-3">
              <img
                src={`/api/admin/mesas/${table.id}/qr?format=png`}
                alt={`Código QR de ${table.label}`}
                width={512}
                height={512}
                className="h-auto w-full"
              />
            </div>
            <p className="mt-3 break-all font-mono text-[0.65rem] leading-relaxed text-ink-faint">
              {menuUrl}
            </p>
            <div className="mt-4 grid gap-2">
              <a
                href={`/api/admin/mesas/${table.id}/qr?format=png&download=1`}
                className="btn-primary btn-sm"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Descargar PNG
              </a>
              <a
                href={menuUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary btn-sm"
              >
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                Abrir carta de la mesa
              </a>
              <a
                href={`/api/admin/mesas/${table.id}/qr`}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost btn-sm"
              >
                <QrCode className="h-3.5 w-3.5" aria-hidden />
                Ver SVG
              </a>
            </div>
          </div>

          <div className="panel p-5">
            <p className="label">Regenerar QR</p>
            <p className="mt-2 text-xs leading-relaxed text-ink-faint">
              Invalida el código actual. Úsalo solo si el cartel se ha compartido por
              error: tendrás que sustituir los carteles impresos.
            </p>
            <ConfirmForm
              action={regenerateTableQrAction}
              message="El QR actual dejará de funcionar inmediatamente. ¿Continuar?"
              confirmLabel="Regenerar QR"
              className="mt-4"
              trigger={
                <>
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Regenerar QR
                </>
              }
            >
              <input type="hidden" name="id" value={table.id} />
            </ConfirmForm>
          </div>
        </aside>
      </div>
    </div>
  );
}
