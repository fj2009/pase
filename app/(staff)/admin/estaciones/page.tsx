import Link from "next/link";
import { ChefHat, Plus, Trash2 } from "lucide-react";
import { MessageFromQuery } from "@/components/ui/banner";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireCapability } from "@/features/auth/session";
import { deleteStationAction, saveStationAction } from "@/features/stations/actions";
import { getStationsAdmin } from "@/features/stations/admin";

export const metadata = { title: "Estaciones · Pase" };

export default async function AdminStationsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const context = await requireCapability("manageMenu");
  const stations = await getStationsAdmin(
    context.user.id,
    context.restaurant.restaurantId,
  );

  return (
    <div className="space-y-8">
      <MessageFromQuery value={params.ok ?? params.error} />
      <PageHeader
        kicker="Cocina"
        title="Estaciones de trabajo"
        description="Cada plato pertenece a una estación. La capacidad indica cuántos platos puede asumir a la vez y alimenta el cálculo de tiempos."
        actions={
          <Link href="/admin/carta" className="btn-secondary btn-sm">
            Ver carta
          </Link>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {stations.length === 0 ? (
            <EmptyState
              title="Sin estaciones"
              description="Crea al menos una estación (por ejemplo, Fríos, Plancha o Postres) antes de asignar platos."
              icon={<ChefHat className="h-5 w-5" strokeWidth={1.5} />}
            />
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {stations.map((station) => (
                <li key={station.id} className="py-4">
                  <form
                    action={saveStationAction}
                    className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_100px_90px_auto_auto]"
                  >
                    <input type="hidden" name="id" value={station.id} />
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <label
                          htmlFor={`station-${station.id}`}
                          className="label"
                        >
                          Estación
                        </label>
                        {station.isActive ? null : (
                          <StatusPill status="closed" label="Inactiva" />
                        )}
                      </div>
                      <input
                        id={`station-${station.id}`}
                        name="name"
                        required
                        maxLength={80}
                        defaultValue={station.name}
                        className="field"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`capacity-${station.id}`}
                        className="label mb-1 block"
                      >
                        Capacidad
                      </label>
                      <input
                        id={`capacity-${station.id}`}
                        name="capacity"
                        type="number"
                        min={1}
                        max={12}
                        required
                        defaultValue={station.capacity}
                        className="field"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`sort-${station.id}`}
                        className="label mb-1 block"
                      >
                        Orden
                      </label>
                      <input
                        id={`sort-${station.id}`}
                        name="sortOrder"
                        type="number"
                        min={0}
                        max={999}
                        defaultValue={station.sortOrder}
                        className="field"
                      />
                    </div>
                    <label className="flex h-10 items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        name="isActive"
                        defaultChecked={station.isActive}
                        className="checkbox"
                      />
                      Activa
                    </label>
                    <SubmitButton size="sm" pendingText="…">
                      Guardar
                    </SubmitButton>
                  </form>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-faint">
                    <p>
                      {station.itemCount}{" "}
                      {station.itemCount === 1 ? "plato" : "platos"} ·{" "}
                      {station.printerCount}{" "}
                      {station.printerCount === 1 ? "impresora" : "impresoras"}
                    </p>
                    {station.itemCount === 0 ? (
                      <ConfirmForm
                        action={deleteStationAction}
                        message={`¿Eliminar la estación «${station.name}»?`}
                        confirmLabel="Eliminar"
                        trigger={
                          <>
                            <Trash2 className="h-3 w-3" aria-hidden />
                            Eliminar
                          </>
                        }
                        triggerClassName="btn-ghost btn-sm text-danger"
                      >
                        <input type="hidden" name="id" value={station.id} />
                      </ConfirmForm>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="panel h-fit p-5">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-olive" aria-hidden />
            <h2 className="text-sm font-semibold">Nueva estación</h2>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-ink-faint">
            Piensa en la cocina real: cada partida con su propia pantalla o impresora.
          </p>
          <form action={saveStationAction} className="mt-4 space-y-3">
            <div>
              <label htmlFor="new-station-name" className="label">
                Nombre
              </label>
              <input
                id="new-station-name"
                name="name"
                required
                maxLength={80}
                placeholder="Fríos, Plancha, Postres…"
                className="field mt-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="new-station-capacity" className="label">
                  Capacidad
                </label>
                <input
                  id="new-station-capacity"
                  name="capacity"
                  type="number"
                  min={1}
                  max={12}
                  defaultValue={2}
                  className="field mt-1.5"
                />
              </div>
              <div>
                <label htmlFor="new-station-sort" className="label">
                  Orden
                </label>
                <input
                  id="new-station-sort"
                  name="sortOrder"
                  type="number"
                  min={0}
                  max={999}
                  defaultValue={0}
                  className="field mt-1.5"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked
                className="checkbox"
              />
              Estación activa
            </label>
            <SubmitButton className="w-full">Crear estación</SubmitButton>
          </form>
        </aside>
      </div>
    </div>
  );
}
