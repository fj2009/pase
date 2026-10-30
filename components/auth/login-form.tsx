"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { loginAction, type LoginState } from "@/features/auth/actions";
import { Banner } from "@/components/ui/banner";
import { SubmitButton } from "@/components/ui/submit-button";

const DEMO_ACCOUNTS = [
  { role: "Propietario", email: "owner@casa-aurelio.es" },
  { role: "Encargada", email: "encargada@casa-aurelio.es" },
  { role: "Sala", email: "sala@casa-aurelio.es" },
  { role: "Cocina", email: "cocina@casa-aurelio.es" },
  { role: "Otro restaurante", email: "owner@lachispa.es" },
];

export function LoginForm({ showDemo }: { showDemo: boolean }) {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <form action={formAction} className="space-y-5">
        {state.error ? <Banner tone="error">{state.error}</Banner> : null}

        <div>
          <label htmlFor="email" className="label mb-2 block">
            Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="field"
            placeholder="nombre@restaurante.es"
          />
        </div>

        <div>
          <label htmlFor="password" className="label mb-2 block">
            Contraseña
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="field pr-11"
              placeholder="••••••••••"
            />
            <button
              type="button"
              onClick={() => setVisible((value) => !value)}
              className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-ink-faint hover:text-ink"
              aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <SubmitButton className="w-full" pendingText="Comprobando…">
          Entrar
        </SubmitButton>
      </form>

      {showDemo ? (
        <div className="mt-8 border-t border-line pt-5">
          <p className="label mb-1">Cuentas de demostración</p>
          <p className="mb-3 text-xs leading-relaxed text-ink-faint">
            Contraseña común: <code className="font-mono text-ink">PaseDemo2026!</code>.
            Elige un perfil para rellenar el formulario.
          </p>
          <div className="flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                className="border border-line-strong px-2.5 py-1.5 text-xs text-ink-soft transition-colors hover:border-ink hover:text-ink"
                onClick={() => {
                  setEmail(account.email);
                  setPassword("PaseDemo2026!");
                }}
              >
                {account.role}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
