"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { CirclePlus, Minus, Plus, Search, Send, Trash2 } from "lucide-react";
import { Banner } from "@/components/ui/banner";
import { SubmitButton } from "@/components/ui/submit-button";
import { submitOrderAction, type OrderActionState } from "@/features/orders/actions";
import type { ComposerCategory, ComposerItem } from "@/features/orders/queries";
import { allergenLabel } from "@/features/menu/allergens";
import { formatPrice } from "@/lib/money";

interface Line {
  key: string;
  item: ComposerItem;
  quantity: number;
  notes: string;
}

export function OrderComposer({
  tableId,
  sessionId,
  tableLabel,
  categories,
  openOrder,
}: {
  tableId: string;
  sessionId: string;
  tableLabel: string;
  categories: ComposerCategory[];
  openOrder: { id: string; number: number } | null;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [state, formAction] = useActionState<OrderActionState, FormData>(
    submitOrderAction,
    {},
  );

  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID());
  }, []);

  const total = lines.reduce(
    (sum, line) => sum + line.item.priceCents * line.quantity,
    0,
  );
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return categories;
    return categories
      .map((category) => ({
        ...category,
        items: category.items.filter(
          (item) =>
            item.name.toLowerCase().includes(term) ||
            item.description?.toLowerCase().includes(term),
        ),
      }))
      .filter((category) => category.items.length > 0);
  }, [categories, search]);

  function addLine(item: ComposerItem) {
    if (!item.isAvailable) return;
    setLines((current) => {
      const mergeable = current.find(
        (line) => line.item.id === item.id && line.notes.trim() === "",
      );
      if (mergeable) {
        return current.map((line) =>
          line.key === mergeable.key
            ? { ...line, quantity: Math.min(99, line.quantity + 1) }
            : line,
        );
      }
      return [
        ...current,
        {
          key: `${item.id}-${crypto.randomUUID()}`,
          item,
          quantity: 1,
          notes: "",
        },
      ];
    });
  }

  function setQuantity(key: string, quantity: number) {
    setLines((current) =>
      current
        .map((line) =>
          line.key === key
            ? { ...line, quantity: Math.max(0, Math.min(99, quantity)) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  function setLineNotes(key: string, value: string) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, notes: value } : line)),
    );
  }

  function countFor(itemId: string): number {
    return lines
      .filter((line) => line.item.id === itemId)
      .reduce((sum, line) => sum + line.quantity, 0);
  }

  const payload = JSON.stringify({
    tableId,
    sessionId,
    orderId: openOrder?.id ?? null,
    notes: notes.trim() || null,
    idempotencyKey,
    items: lines.map((line) => ({
      menuItemId: line.item.id,
      quantity: line.quantity,
      notes: line.notes.trim() || null,
    })),
  });

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section aria-labelledby="carta-titulo">
        <div className="border-y border-line bg-paper-raised">
          <div className="flex items-center gap-2 px-3">
            <Search className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
            <label htmlFor="composer-search" className="sr-only">
              Buscar en la carta
            </label>
            <input
              id="composer-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar un plato o ingrediente…"
              className="h-11 w-full bg-transparent text-sm placeholder:text-ink-faint/70 focus:outline-none"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-xs text-ink-faint hover:text-ink"
              >
                Limpiar
              </button>
            ) : null}
          </div>
          <div className="flex gap-1 overflow-x-auto border-t border-line px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((category) => (
              <a
                key={category.id}
                href={`#composer-${category.id}`}
                className="shrink-0 px-2.5 py-1 text-[0.7rem] text-ink-soft hover:bg-paper-deep hover:text-ink"
              >
                {category.name}
              </a>
            ))}
          </div>
        </div>

        {state.error ? (
          <Banner tone="error" className="mt-4">
            {state.error}
          </Banner>
        ) : null}

        {filtered.length === 0 ? (
          <p className="border border-dashed border-line-strong px-4 py-8 text-sm text-ink-faint">
            No hay platos que coincidan con la búsqueda.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {filtered.map((category) => (
              <div
                key={category.id}
                id={`composer-${category.id}`}
                className="scroll-mt-32 py-5"
              >
                <p className="label mb-3">{category.name}</p>
                <ul className="border border-line bg-paper-raised">
                  {category.items.map((item) => {
                    const quantity = countFor(item.id);
                    return (
                      <li
                        key={item.id}
                        className="flex items-start gap-3 border-b border-line px-3 py-3 last:border-b-0"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <p
                              className={
                                item.isAvailable
                                  ? "text-sm font-medium"
                                  : "text-sm font-medium text-ink-faint line-through"
                              }
                            >
                              {item.name}
                            </p>
                            <span className="font-mono text-xs tabular-nums text-ink-soft">
                              {formatPrice(item.priceCents)}
                            </span>
                            {!item.isAvailable ? (
                              <span className="text-[0.62rem] uppercase tracking-[0.1em] text-terracotta">
                                agotado
                              </span>
                            ) : null}
                          </div>
                          {item.description ? (
                            <p className="mt-0.5 line-clamp-2 text-[0.72rem] leading-relaxed text-ink-faint">
                              {item.description}
                            </p>
                          ) : null}
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.65rem] text-ink-faint">
                            <span>{item.stationName}</span>
                            <span aria-hidden>·</span>
                            <span>{item.prepMinutes} min</span>
                            {item.allergens.length > 0 ? (
                              <>
                                <span aria-hidden>·</span>
                                <span>{item.allergens.map(allergenLabel).join(", ")}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => addLine(item)}
                          disabled={!item.isAvailable}
                          className={
                            quantity > 0
                              ? "btn-secondary btn-sm shrink-0 tabular-nums"
                              : "btn-ghost btn-sm shrink-0"
                          }
                          aria-label={`Añadir ${item.name}`}
                        >
                          {quantity > 0 ? (
                            <>
                              <Plus className="h-3.5 w-3.5" aria-hidden />
                              {quantity}
                            </>
                          ) : (
                            <>
                              <CirclePlus className="h-3.5 w-3.5" aria-hidden />
                              Añadir
                            </>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <aside
        id="comanda"
        className="scroll-mt-32 lg:sticky lg:top-16"
        aria-labelledby="comanda-titulo"
      >
        <form action={formAction} className="border border-line bg-paper-raised">
          <input type="hidden" name="payload" value={payload} readOnly />
          <div className="border-b border-line px-4 py-3">
            <p className="label">Comanda de {tableLabel}</p>
            <h2 id="comanda-titulo" className="mt-1 text-sm font-medium">
              {openOrder
                ? `Se añadirá a la comanda nº ${openOrder.number}`
                : "Nueva comanda"}
            </h2>
          </div>

          {lines.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <UtensilsPlaceholder />
              <p className="mt-2 text-xs leading-relaxed text-ink-faint">
                Añade platos desde la carta para preparar la comanda.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {lines.map((line) => (
                <li key={line.key} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">{line.item.name}</p>
                      <p className="mt-0.5 text-[0.68rem] text-ink-faint">
                        {line.item.stationName} · {formatPrice(line.item.priceCents)}
                      </p>
                    </div>
                    <div className="flex items-center border border-line">
                      <button
                        type="button"
                        onClick={() => setQuantity(line.key, line.quantity - 1)}
                        className="flex h-7 w-7 items-center justify-center text-ink-soft hover:bg-paper-deep"
                        aria-label={`Quitar una unidad de ${line.item.name}`}
                      >
                        <Minus className="h-3 w-3" aria-hidden />
                      </button>
                      <span className="w-7 text-center font-mono text-xs tabular-nums">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity(line.key, line.quantity + 1)}
                        className="flex h-7 w-7 items-center justify-center text-ink-soft hover:bg-paper-deep"
                        aria-label={`Añadir una unidad de ${line.item.name}`}
                      >
                        <Plus className="h-3 w-3" aria-hidden />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setLines((current) => current.filter((item) => item.key !== line.key))
                      }
                      className="mt-1 text-ink-faint hover:text-danger"
                      aria-label={`Quitar ${line.item.name} de la comanda`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                  <label className="mt-2 flex items-center gap-1.5 border-b border-line pb-1 text-[0.68rem] text-ink-faint focus-within:border-olive">
                    <span className="sr-only">Nota para {line.item.name}</span>
                    <input
                      value={line.notes}
                      onChange={(event) => setLineNotes(line.key, event.target.value)}
                      maxLength={300}
                      placeholder="Nota para cocina: sin sal, poco hecho…"
                      className="w-full bg-transparent text-[0.72rem] text-ink placeholder:text-ink-faint/70 focus:outline-none"
                    />
                  </label>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-line px-4 py-3">
            <label htmlFor="order-notes" className="label">
              Nota general
            </label>
            <textarea
              id="order-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Alergias, tiempos o indicaciones de la mesa…"
              className="textarea mt-1.5 min-h-0 text-xs"
            />
          </div>

          <div className="border-t border-line px-4 py-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-ink-faint">
                {itemCount} {itemCount === 1 ? "plato" : "platos"}
              </span>
              <span className="font-mono text-base tabular-nums">{formatPrice(total)}</span>
            </div>
            <SubmitButton
              className="mt-3 w-full"
              pendingText="Enviando a cocina…"
              disabled={lines.length === 0 || !idempotencyKey}
            >
              <Send className="h-4 w-4" aria-hidden />
              {openOrder ? "Añadir a la comanda" : "Enviar comanda"}
            </SubmitButton>
            <p className="mt-2 text-[0.65rem] leading-relaxed text-ink-faint">
              La comanda se envía a las estaciones de cocina y queda registrada con
              quién la creó.
            </p>
          </div>
        </form>
      </aside>

      {lines.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper-raised/95 px-4 py-2.5 backdrop-blur-sm lg:hidden">
          <a href="#comanda" className="btn-primary w-full">
            Revisar comanda · {itemCount} · {formatPrice(total)}
          </a>
        </div>
      ) : null}
    </div>
  );
}

function UtensilsPlaceholder() {
  return (
    <div className="mx-auto flex h-10 w-10 items-center justify-center border border-dashed border-line-strong text-ink-faint">
      <UtensilsIcon />
    </div>
  );
}

function UtensilsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M15 3v18M15 3c4 0 5 3 5 6s-2 4-5 4" />
    </svg>
  );
}
