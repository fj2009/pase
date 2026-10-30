"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, Check, Play, RotateCcw, X } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  cancelItemAction,
  updateItemStatusAction,
} from "@/features/orders/actions";
import {
  nextActions,
  type ItemStatus,
} from "@/features/orders/state-machine";
import { can, type Role } from "@/features/permissions/capabilities";

export function ItemActions({
  itemId,
  dishName,
  status,
  role,
  returnTo,
}: {
  itemId: string;
  dishName: string;
  status: ItemStatus;
  role: Role;
  returnTo: string;
}) {
  const [dialog, setDialog] = useState<"incident" | "cancel" | null>(null);

  if (status === "delivered" || status === "cancelled") {
    return <span className="text-[0.65rem] text-ink-faint">Sin acciones</span>;
  }

  const actions = nextActions(status, role).filter(
    (to) => to !== "cancelled" && to !== "incident",
  );
  const canCancel = can(role, "cancelItems");
  const canIncident = nextActions(status, role).includes("incident");

  if (actions.length === 0 && !canCancel && !canIncident) {
    return <span className="text-[0.65rem] text-ink-faint">Sin acciones</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {actions.map((to) => (
        <form key={to} action={updateItemStatusAction}>
          <input type="hidden" name="itemId" value={itemId} />
          <input type="hidden" name="to" value={to} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <SubmitButton size="sm" variant={to === "delivered" ? "primary" : "secondary"} pendingText="…">
            {to === "preparing" && status === "incident" ? (
              <RotateCcw className="h-3 w-3" aria-hidden />
            ) : to === "preparing" ? (
              <Play className="h-3 w-3" aria-hidden />
            ) : to === "delivered" ? (
              <Check className="h-3 w-3" aria-hidden />
            ) : (
              <ArrowRight className="h-3 w-3" aria-hidden />
            )}
            {labelFor(status, to)}
          </SubmitButton>
        </form>
      ))}

      {canIncident ? (
        <button
          type="button"
          onClick={() => setDialog("incident")}
          className="btn-secondary btn-sm"
        >
          <AlertTriangle className="h-3 w-3" aria-hidden />
          Incidencia
        </button>
      ) : null}

      {canCancel ? (
        <button
          type="button"
          onClick={() => setDialog("cancel")}
          className="btn-ghost btn-sm text-ink-faint hover:text-danger"
        >
          <X className="h-3 w-3" aria-hidden />
          Cancelar
        </button>
      ) : null}

      {dialog ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDialog(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="item-dialog-title"
            className="w-full max-w-sm border border-line-strong bg-paper-raised p-6 shadow-lift"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label mb-2">
                  {dialog === "incident" ? "Incidencia en cocina" : "Cancelar plato"}
                </p>
                <h2 id="item-dialog-title" className="font-display text-2xl leading-tight">
                  {dishName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDialog(null)}
                className="text-ink-faint hover:text-ink"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {dialog === "incident" ? (
              <form action={updateItemStatusAction} className="mt-4">
                <input type="hidden" name="itemId" value={itemId} />
                <input type="hidden" name="to" value="incident" />
                <input type="hidden" name="returnTo" value={returnTo} />
                <label htmlFor="incident-note" className="label">
                  ¿Qué ha pasado?
                </label>
                <textarea
                  id="incident-note"
                  name="note"
                  required
                  maxLength={300}
                  rows={3}
                  placeholder="Falta un ingrediente, se ha caído el plato…"
                  className="textarea mt-1.5"
                />
                <p className="mt-2 text-[0.68rem] leading-relaxed text-ink-faint">
                  Sala verá la incidencia en el seguimiento del pedido. El plato no
                  se marca como listo.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setDialog(null)}
                  >
                    Volver
                  </button>
                  <SubmitButton variant="danger" pendingText="Registrando…">
                    Registrar incidencia
                  </SubmitButton>
                </div>
              </form>
            ) : (
              <form action={cancelItemAction} className="mt-4">
                <input type="hidden" name="itemId" value={itemId} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <label htmlFor="cancel-reason" className="label">
                  Motivo (opcional)
                </label>
                <textarea
                  id="cancel-reason"
                  name="reason"
                  maxLength={300}
                  rows={2}
                  placeholder="El cliente ha cambiado de idea…"
                  className="textarea mt-1.5"
                />
                <p className="mt-2 text-[0.68rem] leading-relaxed text-ink-faint">
                  La cancelación queda registrada en auditoría con tu nombre. No se
                  puede deshacer.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setDialog(null)}
                  >
                    Volver
                  </button>
                  <SubmitButton variant="danger" pendingText="Cancelando…">
                    Cancelar plato
                  </SubmitButton>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function labelFor(from: ItemStatus, to: ItemStatus): string {
  if (to === "preparing") return from === "incident" ? "Reanudar" : "Empezar";
  if (to === "ready") return "Listo";
  if (to === "delivered") return "Servir";
  if (to === "incident") return "Incidencia";
  if (to === "cancelled") return "Cancelar";
  return "Cambiar";
}
