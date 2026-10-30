"use client";

import { useActionState, useState } from "react";
import { Check, Copy, UserPlus } from "lucide-react";
import { inviteMemberAction, type InviteState } from "@/features/staff/actions";

const INITIAL: InviteState = { ok: false };

const ROLES = [
  { value: "waiter", label: "Sala" },
  { value: "kitchen", label: "Cocina" },
  { value: "manager", label: "Encargado" },
  { value: "owner", label: "Propietario" },
];

export function InviteMemberForm() {
  const [state, action, pending] = useActionState(inviteMemberAction, INITIAL);
  const [copied, setCopied] = useState(false);

  if (state.ok) {
    return (
      <div className="border border-ok/30 bg-ok-soft p-4">
        <p className="text-sm font-medium text-ok">Acceso creado para {state.name}</p>
        <p className="mt-1 break-all text-xs text-ink-soft">{state.email}</p>
        {state.password ? (
          <>
            <p className="mt-3 text-[0.68rem] leading-relaxed text-ink-soft">
              Contraseña temporal. La persona deberá cambiarla al entrar. Compártela
              por un canal seguro y no la guardes aquí.
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                readOnly
                value={state.password}
                aria-label="Contraseña temporal"
                className="field font-mono text-xs"
                onFocus={(event) => event.currentTarget.select()}
              />
              <button
                type="button"
                className="btn-secondary btn-sm shrink-0"
                onClick={async () => {
                  await navigator.clipboard.writeText(state.password ?? "");
                  setCopied(true);
                }}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                )}
                {copied ? "Copiada" : "Copiar"}
              </button>
            </div>
          </>
        ) : (
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">
            El correo ya tenía cuenta en Pase. Conserva su contraseña actual y ya puede
            cambiar a este restaurante desde el menú lateral.
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="member-name" className="label">
          Nombre
        </label>
        <input
          id="member-name"
          name="name"
          required
          maxLength={120}
          placeholder="Nombre y apellidos"
          className="field mt-1.5"
        />
      </div>
      <div>
        <label htmlFor="member-email" className="label">
          Correo
        </label>
        <input
          id="member-email"
          name="email"
          type="email"
          required
          autoComplete="off"
          placeholder="persona@restaurante.es"
          className="field mt-1.5"
        />
      </div>
      <div>
        <label htmlFor="member-role" className="label">
          Rol
        </label>
        <select id="member-role" name="role" defaultValue="waiter" className="select mt-1.5">
          {ROLES.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
      </div>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
      <button type="submit" className="btn-primary btn-sm w-full" disabled={pending}>
        <UserPlus className="h-3.5 w-3.5" aria-hidden />
        {pending ? "Creando acceso…" : "Crear acceso"}
      </button>
    </form>
  );
}
