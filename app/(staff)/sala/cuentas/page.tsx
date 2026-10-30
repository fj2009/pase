import Link from "next/link";
import { ArrowLeft, Check, Clock3, ReceiptText, X } from "lucide-react";
import { MessageFromQuery } from "@/components/ui/banner";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireCapability } from "@/features/auth/session";
import { updateBillStatusAction } from "@/features/orders/actions";
import { getBills, type ActiveBill, type BillRowView } from "@/features/orders/queries";
import { elapsedLabel, formatTime } from "@/lib/datetime";
import { formatPrice } from "@/lib/money";

export const metadata = { title: "Cuentas · Pase" };

function BillActions({ bill }: { bill: ActiveBill }) {
  const hidden = (
    <>
      <input type="hidden" name="billId" value={bill.id} />
      <input type="hidden" name="returnTo" value="/sala/cuentas" />
    </>
  );

  if (bill.status === "requested") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <form action={updateBillStatusAction}>
          {hidden}
          <input type="hidden" name="status" value="attending" />
          <SubmitButton size="sm" variant="secondary" pendingText="…">
            <Check className="h-3 w-3" aria-hidden />
            Atender
          </SubmitButton>
        </form>
        <form action={updateBillStatusAction}>
          {hidden}
          <input type="hidden" name="status" value="completed" />
          <SubmitButton size="sm" pendingText="…">
            Cobrada
          </SubmitButton>
        </form>
        <form action={updateBillStatusAction}>
          {hidden}
          <input type="hidden" name="status" value="cancelled" />
          <SubmitButton size="sm" variant="ghost" pendingText="…">
            <X className="h-3 w-3" aria-hidden />
            Descartar
          </SubmitButton>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={updateBillStatusAction}>
        {hidden}
        <input type="hidden" name="status" value="completed" />
        <SubmitButton size="sm" pendingText="…">
          Marcar cobrada
        </SubmitButton>
      </form>
      <form action={updateBillStatusAction}>
        {hidden}
        <input type="hidden" name="status" value="cancelled" />
        <SubmitButton size="sm" variant="ghost" pendingText="…">
          Descartar
        </SubmitButton>
      </form>
    </div>
  );
}

function RecentRow({ bill, timeZone }: { bill: BillRowView; timeZone: string }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-xs">
      <span className="font-medium">Mesa {bill.tableLabel}</span>
      <StatusPill status={bill.status} />
      <span className="text-ink-faint">
        {formatTime(bill.requestedAt, timeZone)}
        {bill.completedAt ? ` → ${formatTime(bill.completedAt, timeZone)}` : ""}
      </span>
      <span className="ml-auto font-mono tabular-nums">{formatPrice(bill.totalCents)}</span>
    </li>
  );
}

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const context = await requireCapability("manageService");
  const data = await getBills(context.user.id, context.restaurant.restaurantId);
  const timeZone = context.restaurant.timezone;

  return (
    <div className="space-y-7">
      <MessageFromQuery value={params.ok ?? params.error} />
      <PageHeader
        kicker="Sala · Cuentas"
        title="Solicitudes de cuenta"
        description="Las mesas piden la cuenta desde la carta digital. Aquí se atienden y se archivan. Pase no cobra ni emite facturas: el cobro se realiza en el TPV habitual."
        actions={
          <Link href="/sala" className="btn-ghost btn-sm">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Volver a sala
          </Link>
        }
      />

      <section>
        <div className="mb-3 flex items-baseline justify-between border-b border-line pb-2">
          <h2 className="font-display text-2xl">Pendientes</h2>
          <p className="meta-mono">{data.active.length} activas</p>
        </div>

        {data.active.length === 0 ? (
          <EmptyState
            title="No hay cuentas pendientes"
            description="Cuando un cliente solicite la cuenta desde el QR de su mesa, aparecerá aquí con el total consumido."
            icon={<ReceiptText className="h-5 w-5" strokeWidth={1.5} aria-hidden />}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.active.map((bill) => (
              <article key={bill.id} className="border border-line bg-paper-raised">
                <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
                  <div>
                    <p className="label">Mesa</p>
                    <p className="mt-0.5 font-display text-3xl leading-none">{bill.tableLabel}</p>
                    <p className="mt-1 text-[0.68rem] text-ink-faint">
                      {bill.zone ?? "Sala"} · {bill.orders}{" "}
                      {bill.orders === 1 ? "comanda" : "comandas"}
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusPill status={bill.status} />
                    <p className="mt-2 font-mono text-lg tabular-nums">
                      {formatPrice(bill.totalCents)}
                    </p>
                  </div>
                </header>
                <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 text-[0.7rem] text-ink-faint">
                  <Clock3 className="h-3 w-3" aria-hidden />
                  Solicitada a las {formatTime(bill.requestedAt, timeZone)} ·{" "}
                  {elapsedLabel(bill.requestedAt)}
                </div>
                {bill.note ? (
                  <p className="border-b border-line px-4 py-2 text-xs text-ink-soft">
                    Nota: {bill.note}
                  </p>
                ) : null}
                <div className="px-4 py-3">
                  <BillActions bill={bill} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between border-b border-line pb-2">
          <h2 className="font-display text-2xl">Últimas 48 horas</h2>
          <p className="meta-mono">Historial reciente</p>
        </div>
        {data.recent.length === 0 ? (
          <p className="text-xs text-ink-faint">Sin cuentas archivadas recientemente.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {data.recent.map((bill) => (
              <RecentRow key={bill.id} bill={bill} timeZone={timeZone} />
            ))}
          </ul>
        )}
      </section>

      <p className="border border-line bg-paper-raised px-4 py-3 text-[0.7rem] leading-relaxed text-ink-faint">
        «Cobrada» es un estado operativo de sala: confirma que el cobro se ha hecho
        en el TPV. No se guardan datos de pago ni se genera una factura desde Pase.
      </p>
    </div>
  );
}
