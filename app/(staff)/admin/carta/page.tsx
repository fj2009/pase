import Link from "next/link";
import { ArrowUpRight, ImageOff, Pencil, Plus, UtensilsCrossed } from "lucide-react";
import { MessageFromQuery } from "@/components/ui/banner";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status";
import { requireCapability } from "@/features/auth/session";
import { getMenuAdmin } from "@/features/menu/admin";
import { setMenuItemAvailabilityAction } from "@/features/menu/actions";
import { formatPrice } from "@/lib/money";

export const metadata = { title: "Carta · Pase" };

export default async function AdminMenuPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const context = await requireCapability("manageMenu");
  const { categories } = await getMenuAdmin(
    context.user.id,
    context.restaurant.restaurantId,
  );
  const itemCount = categories.reduce((total, category) => total + category.items.length, 0);
  const hiddenCount = categories.reduce(
    (total, category) =>
      total + category.items.filter((item) => !item.isPublished).length,
    0,
  );

  return (
    <div className="space-y-8">
      <MessageFromQuery value={params.ok ?? params.error} />
      <PageHeader
        kicker="Carta y precios"
        title="La carta, en orden."
        description={
          itemCount > 0
            ? `${itemCount} platos en ${categories.length} categorías. Los cambios se publican al instante en la carta del QR.`
            : "Crea la primera categoría y añade platos. La carta pública se genera sola."
        }
        actions={
          <>
            <Link
              href={`/carta/${context.restaurant.slug}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary btn-sm"
            >
              Ver carta
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
            <Link href="/admin/carta/categoria/nueva" className="btn-primary btn-sm">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Nueva categoría
            </Link>
          </>
        }
      />

      {hiddenCount > 0 ? (
        <p className="border border-line bg-paper px-4 py-2.5 text-xs text-ink-soft">
          {hiddenCount} {hiddenCount === 1 ? "plato archivado" : "platos archivados"} no
          aparecen en la carta pública. Sigue editándolos desde su ficha.
        </p>
      ) : null}

      {categories.length === 0 ? (
        <EmptyState
          title="Todavía no hay categorías"
          description="Agrupa la carta en entrantes, principales, postres o bebidas. Después podrás añadir platos con su precio, estación y alérgenos."
          icon={<UtensilsCrossed className="h-5 w-5" strokeWidth={1.5} />}
          action={
            <Link href="/admin/carta/categoria/nueva" className="btn-primary btn-sm">
              Crear la primera categoría
            </Link>
          }
        />
      ) : (
        <div className="space-y-10">
          {categories.map((category, index) => (
            <section key={category.id}>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
                <div className="flex items-baseline gap-3">
                  <span className="meta-mono">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold tracking-[-0.02em]">
                        {category.name}
                      </h2>
                      {category.isVisible ? null : (
                        <StatusPill status="closed" label="Oculta" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {category.items.length}{" "}
                      {category.items.length === 1 ? "plato" : "platos"}
                      {category.description ? ` · ${category.description}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/carta/plato/nuevo?categoria=${category.id}`}
                    className="btn-secondary btn-sm"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    Añadir plato
                  </Link>
                  <Link
                    href={`/admin/carta/categoria/${category.id}`}
                    className="btn-ghost btn-sm"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Editar categoría
                  </Link>
                </div>
              </div>

              {category.items.length === 0 ? (
                <p className="border border-dashed border-line-strong px-4 py-6 text-sm text-ink-faint">
                  Esta categoría está vacía.{" "}
                  <Link
                    href={`/admin/carta/plato/nuevo?categoria=${category.id}`}
                    className="link"
                  >
                    Añade el primer plato
                  </Link>
                  .
                </p>
              ) : (
                <ul className="divide-y divide-line border-y border-line">
                  {category.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="h-14 w-20 shrink-0 overflow-hidden bg-paper-deep">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            width={160}
                            height={112}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center text-ink-faint">
                            <ImageOff className="h-4 w-4" aria-hidden />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium">{item.name}</p>
                          {item.isPublished ? null : (
                            <StatusPill status="closed" label="Archivado" />
                          )}
                          {item.isPublished && !item.isAvailable ? (
                            <StatusPill status="incident" label="Agotado" />
                          ) : null}
                        </div>
                        <p className="mt-1 line-clamp-1 text-xs text-ink-faint">
                          {item.stationName} · {item.prepMinutes} min ·{" "}
                          {item.allergens.length > 0
                            ? `${item.allergens.length} alérgenos`
                            : "Sin alérgenos declarados"}
                        </p>
                      </div>

                      <p className="font-mono text-sm tabular-nums sm:w-20 sm:text-right">
                        {formatPrice(item.priceCents)}
                      </p>

                      <div className="flex items-center gap-2">
                        <form action={setMenuItemAvailabilityAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input
                            type="hidden"
                            name="available"
                            value={item.isAvailable ? "0" : "1"}
                          />
                          <button
                            type="submit"
                            className="btn-ghost btn-sm"
                            disabled={!item.isPublished}
                          >
                            {item.isAvailable ? "Marcar agotado" : "Marcar disponible"}
                          </button>
                        </form>
                        <Link
                          href={`/admin/carta/plato/${item.id}`}
                          className="btn-secondary btn-sm"
                        >
                          Editar
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
