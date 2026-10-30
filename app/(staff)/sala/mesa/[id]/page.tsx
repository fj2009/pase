import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Clock3,
  ExternalLink,
  Printer,
  QrCode,
  ReceiptText,
  Send,
} from "lucide-react";
import { ItemActions } from "@/components/staff/item-actions";
import { OrderComposer } from "@/components/staff/order-composer";
import { MessageFromQuery } from "@/components/ui/banner";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireCapability } from "@/features/auth/session";
import {
  closeSessionAction,
  openSessionAction,
  reprintOrderAction,
} from "@/features/orders/actions";
import { getTableDetail } from "@/features/orders/queries";
import { can } from "@/features/permissions/capabilities";
import { elapsedLabel, formatTime } from "@/lib/datetime";
import { formatPrice } from "@/lib/money";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TablePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (!UUID.test(id)) notFound();

  const context = await requireCapability("takeOrders");
  const detail = await getTableDetail(
    context.user.id,
    context.restaurant.restaurantId,
    id,
  );
  if (!detail) notFound();

  const timeZone = context.restaurant.timezone;
  const returnTo = `/sala/mesa/${detail.table.id}`;
  const openOrder = [...detail.orders].reverse().find((order) => order.status === "open") ?? null;
  const items = detail.orders.flatMap((order) => order.items);
  const pending = items.filter((item) =>
    ["queued", "preparing", "incident"].includes(item.status),
  ).length;
  const ready = items.filter((item) => item.status === "ready").length;
  const categories = detail.categories.filter((category) => category.items.length > 0);
  const publicUrl = `/carta/${context.restaurant.slug}?mesa=${detail.table.qrToken}`;

  return (
    <div className="space-y-7">
      <MessageFromQuery value={query.ok ?? query.error} />
      <PageHeader
        kicker={`${detail.table.zone ?? "Sala"} · ${detail.table.seats} plazas`}
        title={`Mesa ${detail.table.label}`}
        description={
          detail.session
            ? `Servicio abierto a las ${formatTime(detail.session.openedAt, timeZone)} (${elapsedLabel(detail.session.openedAt)}).`
            : "La mesa está libre. Ábrela para empezar a tomar comandas."
        }
        actions={
          <>
            <Link href="/sala" className="btn-ghost btn-sm">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Sala
            </Link>
            <Link
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary btn-sm"
            >
              <QrCode className="h-3.5 w-3.5" aria-hidden />
              Carta QR
            </Link>
            {detail.session ? (
              <ConfirmForm
                action={closeSessionAction}
                message={`Se cerrarán la mesa ${detail.table.label} y sus comandas abiertas. Las solicitudes de cuenta pendientes quedarán atendidas.`}
                confirmLabel="Cerrar mesa"
                triggerClassName="btn-secondary btn-sm"
                trigger="Cerrar mesa"
              >
                <input type="hidden" name="tableId" value={detail.table.id} />
                <input type="hidden" name="sessionId" value={detail.session.id} />
                <input type="hidden" name="returnTo" value="/sala" />
              </ConfirmForm>
            ) : null}
          </>
        }
      />

      {!detail.session ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="border border-line bg-paper-raised p-6 sm:p-8">
            <p className="label">Mesa disponible</p>
            <h2 className="mt-2 font-display text-3xl leading-tight">
              Abrir el servicio de la mesa {detail.table.label}
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-soft">
              Al abrir la mesa se crea una sesión de servicio. Las comandas y la
              cuenta quedarán asociadas a esta sesión hasta que la cierres.
            </p>
            <form action={openSessionAction} className="mt-6">
              <input type="hidden" name="tableId" value={detail.table.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <SubmitButton pendingText="Abriendo mesa…">
                <Send className="h-4 w-4" aria-hidden />
                Abrir mesa {detail.table.label}
              </SubmitButton>
            </form>
          </div>
          <aside className="border border-line bg-paper-raised p-5">
            <QrCode className="h-5 w-5 text-olive" strokeWidth={1.5} aria-hidden />
            <h3 className="mt-3 text-sm font-medium">Carta digital de la mesa</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-faint">
              El QR abre la carta pública con el identificador de esta mesa. Los
              clientes pueden pedir la cuenta desde ahí.
            </p>
            <Link
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-olive hover:underline"
            >
              Abrir carta pública
              <ExternalLink className="h-3 w-3" aria-hidden />
            </Link>
          </aside>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 border-y border-line bg-paper-raised sm:grid-cols-4">
            {[
              { label: "Total consumido", value: formatPrice(detail.totalCents), mono: true },
              { label: "Comandas", value: detail.orders.length, mono: true },
              { label: "En cocina", value: pending, mono: true },
              { label: "Listos para servir", value: ready, mono: true },
            ].map((metric) => (
              <div
                key={metric.label}
                className="border-b border-line px-4 py-4 last:border-b-0 even:border-l sm:border-b-0 sm:border-r sm:last:border-r-0 sm:even:border-l-0"
              >
                <dt className="label">{metric.label}</dt>
                <dd
                  className={
                    metric.mono
                      ? "mt-2 font-display text-3xl leading-none tabular-nums"
                      : "mt-2 font-display text-3xl leading-none"
                  }
                >
                  {metric.value}
                </dd>
              </div>
            ))}
          </dl>

          {detail.bill ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border border-terracotta/30 bg-terracotta-soft/60 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-terracotta">
                <ReceiptText className="h-4 w-4" aria-hidden />
                <span>
                  Cuenta {detail.bill.status === "attending" ? "en curso" : "solicitada"} a
                  las {formatTime(detail.bill.requestedAt, timeZone)}
                </span>
              </div>
              <Link
                href="/sala/cuentas"
                className="inline-flex items-center gap-1 text-xs font-medium text-terracotta underline underline-offset-4"
              >
                Gestionar cuenta
                <ArrowUpRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>
          ) : null}

          {categories.length === 0 ? (
            <EmptyState
              title="La carta no tiene platos publicados"
              description="Añade platos desde Gestión → Carta para poder enviar comandas."
              action={
                can(context.role, "manageMenu") ? (
                  <Link href="/admin/carta" className="btn-secondary btn-sm">
                    Editar carta
                  </Link>
                ) : null
              }
            />
          ) : (
            <section>
              <SectionTitle
                index="01"
                title="Tomar comanda"
                description="Selecciona platos y revisa la comanda antes de enviarla a cocina."
              />
              <OrderComposer
                tableId={detail.table.id}
                sessionId={detail.session.id}
                tableLabel={detail.table.label}
                categories={categories}
                openOrder={
                  openOrder ? { id: openOrder.id, number: openOrder.number } : null
                }
              />
            </section>
          )}

          <section>
            <SectionTitle
              index="02"
              title="Comandas de la mesa"
              description="Estado por plato y acciones disponibles según tu rol."
              actions={
                <span className="meta-mono">
                  {detail.orders.length} {detail.orders.length === 1 ? "comanda" : "comandas"}
                </span>
              }
            />
            {detail.orders.length === 0 ? (
              <EmptyState
                title="Todavía no hay comandas"
                description="La primera comanda que envíes aparecerá aquí y en el pase de cocina."
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {detail.orders.map((order) => (
                  <article key={order.id} className="border border-line bg-paper-raised">
                    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold">Comanda nº {order.number}</h3>
                          <StatusPill status={order.status} />
                        </div>
                        <p className="mt-1 flex items-center gap-1 text-[0.68rem] text-ink-faint">
                          <Clock3 className="h-3 w-3" aria-hidden />
                          {formatTime(order.createdAt, timeZone)} ·{" "}
                          {elapsedLabel(order.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/seguimiento/${order.trackingToken}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[0.68rem] font-medium text-olive hover:underline"
                        >
                          Seguimiento
                        </Link>
                        {can(context.role, "reprintTickets") ? (
                          <form action={reprintOrderAction}>
                            <input type="hidden" name="orderId" value={order.id} />
                            <input type="hidden" name="returnTo" value={returnTo} />
                            <SubmitButton
                              variant="ghost"
                              size="sm"
                              pendingText="…"
                              className="h-7 px-2 text-[0.68rem]"
                            >
                              <Printer className="h-3 w-3" aria-hidden />
                              Reimprimir
                            </SubmitButton>
                          </form>
                        ) : null}
                      </div>
                    </header>

                    <ul className="divide-y divide-line">
                      {order.items.map((item) => (
                        <li key={item.id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p
                                className={
                                  item.status === "cancelled"
                                    ? "text-sm text-ink-faint line-through"
                                    : "text-sm"
                                }
                              >
                                <span className="mr-1.5 font-mono text-xs text-ink-faint">
                                  {item.quantity}×
                                </span>
                                {item.name}
                              </p>
                              {item.notes ? (
                                <p className="mt-0.5 text-[0.7rem] text-terracotta">
                                  Nota: {item.notes}
                                </p>
                              ) : null}
                              {item.incidentNote ? (
                                <p className="mt-0.5 text-[0.7rem] text-danger">
                                  Incidencia: {item.incidentNote}
                                </p>
                              ) : null}
                              {item.cancelReason ? (
                                <p className="mt-0.5 text-[0.7rem] text-ink-faint">
                                  Motivo: {item.cancelReason}
                                </p>
                              ) : null}
                            </div>
                            <div className="shrink-0 text-right">
                              <StatusPill status={item.status} />
                              <p className="mt-1 font-mono text-[0.68rem] tabular-nums text-ink-faint">
                                {formatPrice(item.unitPriceCents * item.quantity)}
                              </p>
                            </div>
                          </div>
                          {order.status === "open" ? (
                            <div className="mt-2">
                              <ItemActions
                                itemId={item.id}
                                dishName={item.name}
                                status={item.status}
                                role={context.role}
                                returnTo={returnTo}
                              />
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>

                    <footer className="flex items-center justify-between border-t border-line px-4 py-3">
                      {order.notes ? (
                        <p className="max-w-[70%] text-[0.68rem] leading-relaxed text-ink-faint">
                          Nota de sala: {order.notes}
                        </p>
                      ) : (
                        <span />
                      )}
                      <p className="font-mono text-sm tabular-nums">
                        {formatPrice(order.totalCents)}
                      </p>
                    </footer>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
