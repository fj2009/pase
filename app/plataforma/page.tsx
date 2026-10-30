import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  ExternalLink,
  LogOut,
  Power,
  PowerOff,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { CreateRestaurantForm } from "@/components/platform/create-restaurant-form";
import { MessageFromQuery } from "@/components/ui/banner";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { StatusPill } from "@/components/ui/status";
import { SubmitButton } from "@/components/ui/submit-button";
import { logoutAction } from "@/features/auth/actions";
import { homeForRole, requireSuperadmin } from "@/features/auth/session";
import { getPlatformRestaurants } from "@/features/platform/admin";
import {
  setRestaurantActiveAction,
  updateSubscriptionAction,
} from "@/features/platform/actions";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { formatPrice } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plataforma · Pase" };

const PLAN_LABELS: Record<string, string> = {
  trial: "Prueba",
  basic: "Básico",
  pro: "Pro",
};

export default async function PlatformPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const context = await requireSuperadmin();
  const restaurants = await getPlatformRestaurants(context.user.id);
  const active = restaurants.filter((restaurant) => restaurant.isActive).length;
  const members = restaurants.reduce((total, restaurant) => total + restaurant.members, 0);
  const revenue = restaurants.reduce(
    (total, restaurant) => total + restaurant.revenue30Cents,
    0,
  );

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-paper-raised">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-4">
            <Logo href="/plataforma" />
            <span className="border border-line px-2 py-0.5 text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-faint">
              Plataforma
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium">{context.user.fullName}</p>
              <p className="text-[0.68rem] text-ink-faint">{context.user.email}</p>
            </div>
            {context.restaurant && context.role ? (
              <Link
                href={homeForRole(context.role)}
                className="btn-secondary btn-sm"
              >
                Ir al panel
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            ) : null}
            <form action={logoutAction}>
              <button
                type="submit"
                className="btn-ghost h-8 w-8 px-0"
                aria-label="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main id="contenido" className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <MessageFromQuery value={params.ok ?? params.error} />

        <div className="max-w-2xl">
          <p className="label">Administración global</p>
          <h1 className="mt-2 text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-[2.1rem]">
            Restaurantes en Pase
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Altas, estado del servicio y suscripciones. Cada restaurante mantiene sus
            datos aislados; desde aquí solo se opera el plano de plataforma.
          </p>
        </div>

        <dl className="mt-8 grid grid-cols-3 border-y border-line bg-paper-raised">
          <div className="border-r border-line px-5 py-4">
            <dt className="label">Activos</dt>
            <dd className="mt-2 font-display text-3xl leading-none tabular-nums">
              {active}
              <span className="ml-1 font-sans text-sm text-ink-faint">
                / {restaurants.length}
              </span>
            </dd>
          </div>
          <div className="border-r border-line px-5 py-4">
            <dt className="label">Personas</dt>
            <dd className="mt-2 font-display text-3xl leading-none tabular-nums">
              {members}
            </dd>
          </div>
          <div className="px-5 py-4">
            <dt className="label">Facturación 30 d</dt>
            <dd className="mt-2 font-display text-2xl leading-none tabular-nums">
              {formatPrice(revenue)}
            </dd>
          </div>
        </dl>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-4">
            {restaurants.length === 0 ? (
              <p className="border border-dashed border-line-strong px-4 py-10 text-center text-sm text-ink-faint">
                Todavía no hay restaurantes. Crea el primero desde el panel derecho.
              </p>
            ) : (
              restaurants.map((restaurant) => (
                <article
                  key={restaurant.id}
                  className={`panel p-5 ${restaurant.isActive ? "" : "opacity-75"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold tracking-[-0.01em]">
                          {restaurant.name}
                        </h2>
                        {restaurant.isActive ? (
                          <StatusPill status="active" label="Activo" />
                        ) : (
                          <StatusPill status="closed" label="Suspendido" />
                        )}
                        {restaurant.plan ? (
                          <StatusPill
                            status={restaurant.subscriptionStatus ?? "pending"}
                            label={`${PLAN_LABELS[restaurant.plan] ?? restaurant.plan} · ${
                              restaurant.subscriptionStatus ?? "—"
                            }`}
                          />
                        ) : (
                          <StatusPill status="failed" label="Sin suscripción" />
                        )}
                      </div>
                      <p className="mt-1 font-mono text-[0.68rem] text-ink-faint">
                        /carta/{restaurant.slug}
                        {restaurant.address ? ` · ${restaurant.address}` : ""}
                      </p>
                      <p className="mt-1 text-[0.68rem] text-ink-faint">
                        Alta {formatDate(restaurant.createdAt, restaurant.timezone)}
                        {restaurant.periodEnd
                          ? ` · renueva ${formatDateTime(restaurant.periodEnd, restaurant.timezone)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`/carta/${restaurant.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-ghost btn-sm"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        Carta
                      </a>
                      <ConfirmForm
                        action={setRestaurantActiveAction}
                        message={
                          restaurant.isActive
                            ? `¿Suspender «${restaurant.name}»? Sus usuarios no podrán entrar hasta reactivarlo.`
                            : `¿Reactivar «${restaurant.name}»?`
                        }
                        confirmLabel={restaurant.isActive ? "Suspender" : "Reactivar"}
                        variant={restaurant.isActive ? "danger" : "primary"}
                        trigger={
                          restaurant.isActive ? (
                            <>
                              <PowerOff className="h-3.5 w-3.5" aria-hidden />
                              Suspender
                            </>
                          ) : (
                            <>
                              <Power className="h-3.5 w-3.5" aria-hidden />
                              Reactivar
                            </>
                          )
                        }
                        triggerClassName={
                          restaurant.isActive
                            ? "btn-ghost btn-sm text-danger"
                            : "btn-secondary btn-sm"
                        }
                      >
                        <input type="hidden" name="id" value={restaurant.id} />
                        <input
                          type="hidden"
                          name="active"
                          value={restaurant.isActive ? "0" : "1"}
                        />
                      </ConfirmForm>
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-4 gap-3 border-t border-line pt-3 text-xs">
                    <div>
                      <dt className="text-ink-faint">Equipo</dt>
                      <dd className="mt-0.5 font-mono tabular-nums">{restaurant.members}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-faint">Mesas</dt>
                      <dd className="mt-0.5 font-mono tabular-nums">{restaurant.tables}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-faint">Comandas 30 d</dt>
                      <dd className="mt-0.5 font-mono tabular-nums">{restaurant.orders30}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-faint">Facturado 30 d</dt>
                      <dd className="mt-0.5 font-mono tabular-nums">
                        {formatPrice(restaurant.revenue30Cents)}
                      </dd>
                    </div>
                  </dl>

                  {restaurant.plan ? (
                    <form
                      action={updateSubscriptionAction}
                      className="mt-4 grid items-end gap-2 border-t border-line pt-3 sm:grid-cols-[110px_120px_80px_auto]"
                    >
                      <input type="hidden" name="id" value={restaurant.id} />
                      <div>
                        <label
                          htmlFor={`plan-${restaurant.id}`}
                          className="label mb-1 block"
                        >
                          Plan
                        </label>
                        <select
                          id={`plan-${restaurant.id}`}
                          name="plan"
                          defaultValue={restaurant.plan}
                          className="select h-8 text-xs"
                        >
                          <option value="trial">Prueba</option>
                          <option value="basic">Básico</option>
                          <option value="pro">Pro</option>
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor={`status-${restaurant.id}`}
                          className="label mb-1 block"
                        >
                          Estado
                        </label>
                        <select
                          id={`status-${restaurant.id}`}
                          name="status"
                          defaultValue={restaurant.subscriptionStatus ?? "trialing"}
                          className="select h-8 text-xs"
                        >
                          <option value="trialing">Prueba</option>
                          <option value="active">Activa</option>
                          <option value="past_due">Impagada</option>
                          <option value="cancelled">Cancelada</option>
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor={`seats-${restaurant.id}`}
                          className="label mb-1 block"
                        >
                          Plazas
                        </label>
                        <input
                          id={`seats-${restaurant.id}`}
                          name="seats"
                          type="number"
                          min={1}
                          max={500}
                          defaultValue={restaurant.members || 5}
                          className="field h-8 text-xs"
                        />
                      </div>
                      <SubmitButton size="sm" pendingText="…">
                        Guardar
                      </SubmitButton>
                    </form>
                  ) : null}
                </article>
              ))
            )}
          </section>

          <aside className="panel h-fit p-5">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-olive" aria-hidden />
              <h2 className="text-sm font-semibold">Nuevo restaurante</h2>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-ink-faint">
              Se crea en prueba 30 días con estaciones Cocina y Barra. Puedes asignar
              un propietario ahora o después.
            </p>
            <div className="mt-4">
              <CreateRestaurantForm />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
