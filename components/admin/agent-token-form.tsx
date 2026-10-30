"use client";

import { useActionState, useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { createPrintAgentAction, type AgentState } from "@/features/printing/actions";

const INITIAL: AgentState = { ok: false };

export function AgentTokenForm() {
  const [state, action, pending] = useActionState(createPrintAgentAction, INITIAL);
  const [copied, setCopied] = useState(false);

  if (state.token) {
    return (
      <div className="border border-amber/40 bg-amber-soft p-4">
        <p className="text-xs font-semibold text-amber">
          Copia este token ahora: no se volverá a mostrar.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={state.token}
            aria-label="Token del agente"
            className="field font-mono text-[0.7rem]"
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            type="button"
            className="btn-secondary btn-sm shrink-0"
            onClick={async () => {
              await navigator.clipboard.writeText(state.token ?? "");
              setCopied(true);
            }}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden />
            )}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
        <p className="mt-3 text-[0.68rem] leading-relaxed text-amber/80">
          Configúralo como <code className="font-mono">PASE_AGENT_TOKEN</code> en el
          equipo donde corre <code className="font-mono">npm run print:agent</code>.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="agent-name" className="label">
          Nombre del agente
        </label>
        <input
          id="agent-name"
          name="name"
          required
          maxLength={80}
          placeholder="Ordenador de barra, Raspberry cocina…"
          className="field mt-1.5"
        />
      </div>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
      <button type="submit" className="btn-secondary btn-sm" disabled={pending}>
        <KeyRound className="h-3.5 w-3.5" aria-hidden />
        {pending ? "Creando…" : "Crear token de agente"}
      </button>
    </form>
  );
}
