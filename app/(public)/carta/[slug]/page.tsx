import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { BillRequestCard } from "@/components/public/bill-request-card";
import { AllergenList } from "@/components/public/allergen-list";
import { getPublicMenu } from "@/features/menu/public";
import { formatPrice } from "@/lib/money";
import { formatTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mesa?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { mesa } = await searchParams;
  const menu = await getPublicMenu(slug, mesa);
  return {
    title: menu ? `Carta de ${menu.restaurant.name}` : "Carta",
    description: menu
      ? `Carta digital de ${menu.restaurant.name}. Precios en euros, alérgenos y disponibilidad actualizada.`
      : undefined,
  };
}

export default async function PublicMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mesa?: string }>;
}) {
  const { slug } = await params;
  const { mesa } = await searchParams;
  const tableToken =
    typeof mesa === "string" && mesa.length <= 120 ? mesa : undefined;
  const menu = await getPublicMenu(slug, tableToken);

  if (!menu) notFound();

  const latestOrder = menu.orders.find((order) => order.status === "open") ?? menu.orders[0];
  const totalItems = menu.categories.reduce((sum, category) => sum + category.items.length, 0);
  const timeZone = menu.restaurant.timezone;

  return (
    <main id="contenido" className="pb-24">
      <div className="border-b border-line bg-paper-raised">
        <div className="mx-auto max-w-3xl px-5 pb-8 pt-7 sm:px-8 sm:pb-10">
          <div className="flex items-start justify-between gap-4">
            <p className="label">
              Carta{menu.table ? ` · ${menu.table.label}` : ""}
            </p>
            {menu.table ? (
              <span className="border border-line-strong px-2 py-1 text-[0.65rem] font-medium uppercase tracking-[0.1em] text-ink-soft">
                {menu.table.zone ?? "Sala"} · {menu.table.label}
              </span>
            ) : null}
          </div>

          <h1 className="mt-7 text-balance font-display text-5xl font-normal leading-[0.95] tracking-[-0.02em] sm:text-6xl">
            {menu.restaurant.name}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
            {menu.restaurant.address ? <span>{menu.restaurant.address}</span> : null}
            {menu.session ? (
              <span>
                Servicio abierto a las {formatTime(menu.session.opened_at, timeZone)}
              </span>
            ) : (
              <span>Consulta de carta</span>
            )}
            <span>{totalItems} platos</span>
          </div>

          {menu.orders.length > 0 ? (
            <div className="mt-7 border border-line bg-paper px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="meta-mono">Tu comanda</p>
                  <p className="mt-1 text-sm">
                    Nº {latestOrder?.order_number} ·{" "}
                    {latestOrder?.status === "open" ? "en servicio" : "cerrada"} ·{" "}
                    {formatPrice(latestOrder?.total_cents ?? 0)}
                  </p>
                </div>
                {latestOrder ? (
                  <Link
                    href={`/seguimiento/${latestOrder.tracking_token}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-olive underline decoration-olive/30 underline-offset-4 hover:decoration-olive"
                  >
                    Seguir el pedido
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                ) : null}
              </div>
              {menu.orders.length > 1 ? (
                <p className="mt-2 text-[0.7rem] text-ink-faint">
                  Hay {menu.orders.length} comandas recientes en esta mesa.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <nav
        aria-label="Categorías de la carta"
        className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur-sm"
      >
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-5 py-2 sm:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {menu.categories.map((category, index) => (
            <a
              key={category.id}
              href={`#categoria-${index + 1}`}
              className="shrink-0 px-3 py-2 text-xs text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
            >
              <span className="mr-1.5 font-mono text-[0.6rem] text-ink-faint">
                {String(index + 1).padStart(2, "0")}
              </span>
              {category.name}
            </a>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        {menu.categories.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-display text-2xl">La carta todavía se está preparando.</p>
            <p className="mt-2 text-sm text-ink-faint">
              El establecimiento aún no ha publicado platos.
            </p>
          </div>
        ) : (
          menu.categories.map((category, index) => (
            <section
              key={category.id}
              id={`categoria-${index + 1}`}
              className="scroll-mt-16 border-b border-line py-10 last:border-b-0"
            >
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <p className="meta-mono mb-2">{String(index + 1).padStart(2, "0")}</p>
                  <h2 className="font-display text-3xl font-normal tracking-[-0.015em]">
                    {category.name}
                  </h2>
                  {category.description ? (
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-soft">
                      {category.description}
                    </p>
                  ) : null}
                </div>
              </div>

              <ul className="mt-6">
                {category.items.map((item) => (
                  <li
                    key={item.id}
                    className="grid grid-cols-[1fr_auto] gap-4 border-t border-line py-5 first:border-t-0 first:pt-0 sm:gap-6"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h3
                          className={
                            item.is_available
                              ? "text-[0.98rem] font-medium tracking-[-0.01em]"
                              : "text-[0.98rem] font-medium tracking-[-0.01em] text-ink-faint"
                          }
                        >
                          {item.name}
                        </h3>
                        {!item.is_available ? (
                          <span className="border border-line-strong px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-[0.1em] text-ink-faint">
                            Agotado
                          </span>
                        ) : null}
                      </div>
                      {item.description ? (
                        <p className="mt-1 max-w-xl text-[0.84rem] leading-relaxed text-ink-soft">
                          {item.description}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="meta-mono">{item.prep_minutes} min aprox.</span>
                        <AllergenList allergens={item.allergens} />
                      </div>
                      {item.ingredients ? (
                        <p className="mt-1.5 text-[0.72rem] leading-relaxed text-ink-faint">
                          Ingredientes declarados: {item.ingredients}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className="font-mono text-sm tabular-nums">
                        {formatPrice(item.price_cents)}
                      </span>
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          width={180}
                          height={135}
                          loading="lazy"
                          decoding="async"
                          className={
                            item.is_available
                              ? "h-[72px] w-[96px] object-cover sm:h-[90px] sm:w-[120px]"
                              : "h-[72px] w-[96px] object-cover opacity-45 grayscale sm:h-[90px] sm:w-[120px]"
                          }
                        />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        <section id="cuenta" className="scroll-mt-16 border-t border-line py-10">
          <div className="grid gap-6 sm:grid-cols-[1fr_280px] sm:items-start">
            <div>
              <p className="label mb-2">Al final del servicio</p>
              <h2 className="font-display text-3xl font-normal leading-tight">
                ¿Todo bien? Podemos traer la cuenta.
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
                La solicitud avisa al personal de sala. No emite una factura ni
                realiza ningún cobro desde el móvil.
              </p>
            </div>
            <BillRequestCard
              slug={slug}
              tableToken={tableToken}
              initialStatus={menu.bill_request?.status ?? null}
              serviceOpen={menu.service_open}
              tableLabel={menu.table?.label ?? null}
            />
          </div>
        </section>

        <footer className="border-t border-line py-8 text-[0.7rem] leading-relaxed text-ink-faint">
          <p>
            Alérgenos e ingredientes declarados por el establecimiento. Si tienes
            una alergia o intolerancia, consulta siempre con el personal antes de
            pedir.
          </p>
          <p className="mt-2">
            Carta gestionada con{" "}
            <Link href="/" className="link">
              Pase
            </Link>
            . Precios en euros, IVA incluido.
          </p>
        </footer>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper-raised/95 px-4 py-3 backdrop-blur-sm sm:hidden">
        <div className="mx-auto flex max-w-3xl gap-2">
          {latestOrder ? (
            <Link
              href={`/seguimiento/${latestOrder.tracking_token}`}
              className="btn-secondary flex-1"
            >
              Seguir pedido
            </Link>
          ) : null}
          <a href="#cuenta" className="btn-primary flex-1">
            Pedir la cuenta
          </a>
        </div>
      </div>
    </main>
  );
}
