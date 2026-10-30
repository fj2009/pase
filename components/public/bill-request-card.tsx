"use client";

import { useRef, useState } from "react";
import { Check, LoaderCircle, ReceiptText, X } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

type State = "idle" | "confirm" | "loading" | "requested" | "error";

export function BillRequestCard({
  slug,
  tableToken,
  initialStatus,
  serviceOpen,
  tableLabel,
}: {
  slug: string;
  tableToken?: string;
  initialStatus: string | null;
  serviceOpen: boolean;
  tableLabel: string | null;
}) {
  const [state, setState] = useState<State>(
    initialStatus ? "requested" : "idle",
  );
  const [message, setMessage] = useState(
    initialStatus === "attending"
      ? "El personal está atendiendo tu cuenta."
      : initialStatus
        ? "Cuenta solicitada. El personal se acercará a la mesa."
        : "",
  );
  const idempotencyKey = useRef<string>(crypto.randomUUID());

  async function requestBill() {
    setState("loading");
    try {
      const response = await fetch("/api/public/bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          tableToken,
          idempotencyKey: idempotencyKey.current,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
        status?: string;
      };
      if (!response.ok || !data.ok) {
        setMessage(data.message ?? "No se ha podido enviar la solicitud.");
        setState("error");
        return;
      }
      setMessage(
        data.status === "attending"
          ? "El personal está atendiendo tu cuenta."
          : "Cuenta solicitada. El personal se acercará a la mesa.",
      );
      setState("requested");
      idempotencyKey.current = crypto.randomUUID();
    } catch {
      setMessage("No hay conexión. Inténtalo de nuevo cuando recuperes la red.");
      setState("error");
    }
  }

  if (!tableToken) {
    return (
      <div className="border border-line bg-paper-raised px-4 py-3 text-xs leading-relaxed text-ink-faint">
        Estás viendo la carta pública. Para pedir la cuenta, escanea el QR de tu
        mesa.
      </div>
    );
  }

  if (!serviceOpen) {
    return (
      <div className="border border-line bg-paper-raised px-4 py-3 text-xs leading-relaxed text-ink-faint">
        No hay un servicio abierto en {tableLabel ?? "esta mesa"}. Pide al personal
        que abra la mesa para solicitar la cuenta.
      </div>
    );
  }

  return (
    <div>
      {state === "requested" ? (
        <div className="flex items-start gap-3 border border-ok/30 bg-ok-soft px-4 py-3 text-sm text-ok">
          <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Solicitud enviada</p>
            <p className="mt-0.5 text-xs leading-relaxed">{message}</p>
            <p className="mt-1 text-[0.65rem] leading-relaxed opacity-80">
              La solicitud no emite una factura ni realiza ningún cobro.
            </p>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={buttonClass("secondary", "md", "w-full")}
          onClick={() => setState("confirm")}
          disabled={state === "loading"}
        >
          <ReceiptText className="h-4 w-4" aria-hidden />
          Pedir la cuenta
        </button>
      )}

      {state === "error" ? (
        <p role="alert" className="mt-2 text-xs leading-relaxed text-danger">
          {message}
        </p>
      ) : null}

      {state === "loading" ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-ink-faint">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Enviando solicitud…
        </p>
      ) : null}

      {state === "confirm" ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setState("idle");
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="bill-title"
            className="w-full max-w-sm border border-line-strong bg-paper-raised p-6 shadow-lift"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label mb-2">Solicitud de cuenta</p>
                <h2 id="bill-title" className="font-display text-2xl leading-tight">
                  ¿Pedir la cuenta en {tableLabel ?? "esta mesa"}?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setState("idle")}
                className="text-ink-faint hover:text-ink"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Avisaremos al personal de sala. La solicitud no emite una factura ni
              realiza ningún cobro.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className={buttonClass("secondary")}
                onClick={() => setState("idle")}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={buttonClass("primary")}
                onClick={requestBill}
              >
                Sí, pedir la cuenta
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
