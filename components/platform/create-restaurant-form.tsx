"use client";

import { useActionState, useState } from "react";
import { Building2, Check, Copy } from "lucide-react";
import {
  createRestaurantAction,
  type CreateRestaurantState,
} from "@/features/platform/actions";

const INITIAL: CreateRestaurantState = { ok: false };

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function CreateRestaurantForm() {
  const [state, action, pending] = useActionState(createRestaurantAction, INITIAL);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [copied, setCopied] = useState(false);

  if (state.ok) {
    return (
      <div className="border border-ok/30 bg-ok-soft p-4">
        <p className="text-sm font-medium text-ok">«{state.name}» creado</p>
        {state.ownerEmail ? (
          <p className="mt-1 break-all text-xs text-ink-soft">{state.ownerEmail}</p>
        ) : (
          <p className="mt-1 text-xs text-ink-soft">
            Sin propietario asignado. Añádelo después desde el restaurante.
          </p>
        )}
        {state.password ? (
          <>
            <p className="mt-3 text-[0.68rem] leading-relaxed text-ink-soft">
              Contraseña temporal del propietario. Compártela por un canal seguro.
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
        ) : state.ownerEmail ? (
          <p className="mt-2 text-xs text-ink-soft">
            La cuenta ya existía; conserva su contraseña actual.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="restaurant-name" className="label">
          Nombre
        </label>
        <input
          id="restaurant-name"
          name="name"
          required
          maxLength={120}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (!slugTouched) setSlug(slugify(event.target.value));
          }}
          placeholder="Casa Aurelio"
          className="field mt-1.5"
        />
      </div>
      <div>
        <label htmlFor="restaurant-slug" className="label">
          Slug público
        </label>
        <input
          id="restaurant-slug"
          name="slug"
          required
          maxLength={80}
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(slugify(event.target.value));
          }}
          placeholder="casa-aurelio"
          className="field mt-1.5 font-mono text-xs"
        />
        <p className="mt-1 text-[0.68rem] text-ink-faint">
          La carta quedará en /carta/{slug || "slug"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="restaurant-timezone" className="label">
            Zona horaria
          </label>
          <select
            id="restaurant-timezone"
            name="timezone"
            defaultValue="Europe/Madrid"
            className="select mt-1.5"
          >
            <option value="Europe/Madrid">Europe/Madrid</option>
            <option value="Atlantic/Canary">Atlantic/Canary</option>
            <option value="Europe/Lisbon">Europe/Lisbon</option>
            <option value="Europe/Paris">Europe/Paris</option>
          </select>
        </div>
        <div>
          <label htmlFor="restaurant-accent" className="label">
            Acento
          </label>
          <select
            id="restaurant-accent"
            name="accent"
            defaultValue="olive"
            className="select mt-1.5"
          >
            <option value="olive">Oliva</option>
            <option value="terracotta">Terracota</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="restaurant-address" className="label">
          Dirección
        </label>
        <input
          id="restaurant-address"
          name="address"
          maxLength={200}
          placeholder="Calle, número, ciudad"
          className="field mt-1.5"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="restaurant-owner-name" className="label">
            Propietario
          </label>
          <input
            id="restaurant-owner-name"
            name="ownerName"
            maxLength={120}
            placeholder="Nombre y apellidos"
            className="field mt-1.5"
          />
        </div>
        <div>
          <label htmlFor="restaurant-owner-email" className="label">
            Correo
          </label>
          <input
            id="restaurant-owner-email"
            name="ownerEmail"
            type="email"
            autoComplete="off"
            placeholder="persona@restaurante.es"
            className="field mt-1.5"
          />
        </div>
      </div>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
      <button type="submit" className="btn-primary btn-sm w-full" disabled={pending}>
        <Building2 className="h-3.5 w-3.5" aria-hidden />
        {pending ? "Creando…" : "Crear restaurante"}
      </button>
    </form>
  );
}
