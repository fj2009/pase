import Link from "next/link";
import {
  KeyRound,
  Plus,
  Printer,
  RefreshCw,
  ShieldOff,
  Trash2,
  Wifi,
} from "lucide-react";
import { AgentTokenForm } from "@/components/admin/agent-token-form";
import { PrinterForm } from "@/components/admin/printer-form";
import { MessageFromQuery } from "@/components/ui/banner";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status";
import { requireCapability } from "@/features/auth/session";
import {
  deletePrinterAction,
  retryPrintJobAction,
  revokePrintAgentAction,
  savePrinterAction,
  testPrintAction,
} from "@/features/printing/actions";
import {
  getPrintAgents,
  getPrintJobs,
  getPrintersAdmin,
} from "@/features/printing/admin";
import { getStationsAdmin } from "@/features/stations/admin";
import { formatDateTime, formatShortDate } from "@/lib/datetime";

export const metadata = { title: "Impresión · Pase" };

const KIND_LABELS = {
  test: "Prueba",
  network: "Red TCP",
  usb_agent: "USB con agente",
} as const;

const JOB_LABELS: Record<string, string> = {
  order: "Comanda",
  reprint: "Reimpresión",
  test: "Prueba",
};

export default async function AdminPrintingPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const context = await requireCapability("managePrinters");
  const [printers, agents, jobs, stations] = await Promise.all([
    getPrintersAdmin(context.user.id, context.restaurant.restaurantId),
    getPrintAgents(context.user.id, context.restaurant.restaurantId),
    getPrintJobs(context.user.id, context.restaurant.restaurantId),
    getStationsAdmin(context.user.id, context.restaurant.restaurantId),
  ]);
  const activeStations = stations
    .filter((station) => station.isActive)
    .map((station) => ({ id: station.id, name: station.name }));
  const timeZone = context.restaurant.timezone;
  const pending = jobs.filter(
    (job) => job.status === "pending" || job.status === "processing",
  ).length;
  const failed = jobs.filter((job) => job.status === "failed").length;

  return (
    <div className="space-y-8">
      <MessageFromQuery value={params.ok ?? params.error} />
      <PageHeader
        kicker="Operación"
        title="Impresión y agentes"
        description="Las comandas se agrupan por impresora según la estación del plato. El agente local reclama la cola y confirma cada ticket."
        actions={
          <Link href="/admin/estaciones" className="btn-secondary btn-sm">
            Estaciones
          </Link>
        }
      />

      <dl className="grid grid-cols-3 border-y border-line bg-paper-raised">
        <div className="border-r border-line px-5 py-4">
          <dt className="label">Impresoras</dt>
          <dd className="mt-2 font-display text-3xl leading-none tabular-nums">
            {printers.filter((printer) => printer.isActive).length}
          </dd>
        </div>
        <div className="border-r border-line px-5 py-4">
          <dt className="label">En cola</dt>
          <dd className="mt-2 font-display text-3xl leading-none tabular-nums">{pending}</dd>
        </div>
        <div className="px-5 py-4">
          <dt className="label">Fallidos</dt>
          <dd className="mt-2 font-display text-3xl leading-none tabular-nums">{failed}</dd>
        </div>
      </dl>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold">Impresoras del restaurante</h2>
          {printers.length === 0 ? (
            <EmptyState
              title="Sin impresoras configuradas"
              description="Puedes trabajar sin hardware usando una impresora de prueba: los tickets quedan en la cola y los ves aquí."
              icon={<Printer className="h-5 w-5" strokeWidth={1.5} />}
            />
          ) : (
            <ul className="space-y-4">
              {printers.map((printer) => (
                <li key={printer.id} className="panel p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">{printer.name}</h3>
                        <StatusPill
                          status={printer.isActive ? "active" : "closed"}
                          label={printer.isActive ? "Activa" : "Inactiva"}
                        />
                        {printer.pendingJobs > 0 ? (
                          <span className="meta-mono">{printer.pendingJobs} en cola</span>
                        ) : null}
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-faint">
                        <Wifi className="h-3 w-3" aria-hidden />
                        {KIND_LABELS[printer.kind]} · {printer.paperWidth} mm
                        {printer.target ? ` · ${printer.target}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {printer.stations.length === 0 ? (
                          <span className="text-[0.68rem] text-terracotta">
                            Sin estaciones asignadas: no recibirá comandas.
                          </span>
                        ) : (
                          printer.stations.map((station) => (
                            <span
                              key={station.id}
                              className="border border-line px-1.5 py-0.5 text-[0.65rem] text-ink-soft"
                            >
                              {station.name}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <form action={testPrintAction}>
                        <input type="hidden" name="id" value={printer.id} />
                        <button
                          type="submit"
                          className="btn-ghost btn-sm"
                          disabled={!printer.isActive}
                        >
                          Probar
                        </button>
                      </form>
                      <ConfirmForm
                        action={deletePrinterAction}
                        message={`¿Eliminar la impresora «${printer.name}»?`}
                        confirmLabel="Eliminar"
                        trigger={
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        }
                        triggerClassName="btn-ghost btn-sm text-danger"
                      >
                        <input type="hidden" name="id" value={printer.id} />
                      </ConfirmForm>
                    </div>
                  </div>

                  <details className="group mt-4 border-t border-line pt-3">
                    <summary className="cursor-pointer list-none text-xs font-medium text-olive hover:text-olive-deep">
                      Editar configuración
                    </summary>
                    <div className="mt-4">
                      <PrinterForm
                        action={savePrinterAction}
                        printer={printer}
                        stations={activeStations}
                      />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-6">
          <section className="panel p-5">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-olive" aria-hidden />
              <h2 className="text-sm font-semibold">Nueva impresora</h2>
            </div>
            <div className="mt-4">
              <PrinterForm
                action={savePrinterAction}
                stations={activeStations}
              />
            </div>
          </section>

          <section className="panel p-5">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-olive" aria-hidden />
              <h2 className="text-sm font-semibold">Agentes locales</h2>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-ink-faint">
              Cada equipo que imprima en USB necesita su propio token.
            </p>
            <div className="mt-4">
              <AgentTokenForm />
            </div>
          </section>
        </aside>
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3 border-b border-line pb-2">
          <h2 className="text-sm font-semibold">Cola de impresión</h2>
          <span className="meta-mono">Últimos {jobs.length}</span>
        </div>
        {jobs.length === 0 ? (
          <p className="border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-faint">
            No hay trabajos todavía. Envía una comanda desde sala o usa «Probar».
          </p>
        ) : (
          <div className="overflow-x-auto border border-line">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-paper-deep text-[0.65rem] uppercase tracking-[0.08em] text-ink-faint">
                <tr>
                  <th className="px-3 py-2 font-medium">Creado</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Impresora</th>
                  <th className="px-3 py-2 font-medium">Origen</th>
                  <th className="px-3 py-2 font-medium">Líneas</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Intentos</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {jobs.map((job) => (
                  <tr key={job.id} className="align-top">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[0.68rem] text-ink-soft">
                      {formatShortDate(job.createdAt, timeZone)}{" "}
                      {formatDateTime(job.createdAt, timeZone).split(", ").at(-1)}
                    </td>
                    <td className="px-3 py-2">{JOB_LABELS[job.jobType] ?? job.jobType}</td>
                    <td className="px-3 py-2">{job.printerName}</td>
                    <td className="px-3 py-2">
                      {job.orderNumber ? `#${job.orderNumber}` : "—"}
                      {job.tableLabel ? ` · ${job.tableLabel}` : ""}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{job.itemCount}</td>
                    <td className="px-3 py-2">
                      <StatusPill status={job.status} />
                      {job.lastError ? (
                        <p className="mt-1 max-w-[180px] truncate text-[0.65rem] text-danger">
                          {job.lastError}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{job.attempts}</td>
                    <td className="px-3 py-2 text-right">
                      {job.status === "failed" || job.status === "pending" ? (
                        <form action={retryPrintJobAction}>
                          <input type="hidden" name="id" value={job.id} />
                          <button type="submit" className="btn-ghost btn-sm">
                            <RefreshCw className="h-3 w-3" aria-hidden />
                            Reintentar
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3 border-b border-line pb-2">
          <h2 className="text-sm font-semibold">Tokens de agente</h2>
          <span className="meta-mono">{agents.length}</span>
        </div>
        {agents.length === 0 ? (
          <p className="border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-faint">
            Sin agentes. Crea un token arriba si vas a imprimir por USB.
          </p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {agents.map((agent) => (
              <li
                key={agent.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{agent.name}</p>
                  <p className="mt-0.5 text-[0.68rem] text-ink-faint">
                    Creado {formatDateTime(agent.createdAt, timeZone)} ·{" "}
                    {agent.revokedAt
                      ? `revocado ${formatDateTime(agent.revokedAt, timeZone)}`
                      : agent.lastSeenAt
                        ? `visto ${formatDateTime(agent.lastSeenAt, timeZone)}`
                        : "nunca conectado"}
                  </p>
                </div>
                {agent.revokedAt ? (
                  <StatusPill status="closed" label="Revocado" />
                ) : (
                  <ConfirmForm
                    action={revokePrintAgentAction}
                    message={`¿Revocar el token de «${agent.name}»? El agente dejará de poder reclamar trabajos.`}
                    confirmLabel="Revocar token"
                    trigger={
                      <>
                        <ShieldOff className="h-3 w-3" aria-hidden />
                        Revocar
                      </>
                    }
                    triggerClassName="btn-ghost btn-sm text-danger"
                  >
                    <input type="hidden" name="id" value={agent.id} />
                  </ConfirmForm>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
