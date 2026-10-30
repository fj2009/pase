import { ShieldCheck, Trash2 } from "lucide-react";
import { InviteMemberForm } from "@/components/admin/invite-member-form";
import { MessageFromQuery } from "@/components/ui/banner";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireCapability } from "@/features/auth/session";
import { ROLE_LABELS, ROLE_ORDER } from "@/features/permissions/capabilities";
import {
  removeMemberAction,
  updateMemberRoleAction,
} from "@/features/staff/actions";
import { getMembers } from "@/features/staff/admin";
import { formatDateTime } from "@/lib/datetime";

export const metadata = { title: "Equipo · Pase" };

export default async function AdminTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const context = await requireCapability("manageStaff");
  const members = await getMembers(context.user.id, context.restaurant.restaurantId);
  const timeZone = context.restaurant.timezone;

  return (
    <div className="space-y-8">
      <MessageFromQuery value={params.ok ?? params.error} />
      <PageHeader
        kicker="Personas"
        title="Equipo y accesos"
        description="Cada rol ve solo lo que necesita. Las cuentas nuevas entran con una contraseña temporal y deben cambiarla."
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          <div className="mb-3 flex items-end justify-between border-b border-line pb-2">
            <h2 className="text-sm font-semibold">Personas con acceso</h2>
            <span className="meta-mono">{members.length}</span>
          </div>
          <ul className="divide-y divide-line border-y border-line">
            {members.map((member) => {
              const isSelf = member.userId === context.user.id;
              return (
                <li key={member.id} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{member.fullName}</p>
                        {isSelf ? (
                          <StatusPill status="active" label="Tú" />
                        ) : null}
                        {member.isActive ? null : (
                          <StatusPill status="closed" label="Cuenta inactiva" />
                        )}
                      </div>
                      <p className="mt-0.5 break-all text-xs text-ink-faint">
                        {member.email}
                      </p>
                      <p className="mt-1 text-[0.68rem] text-ink-faint">
                        {member.lastLoginAt
                          ? `Último acceso ${formatDateTime(member.lastLoginAt, timeZone)}`
                          : "Nunca ha entrado"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-end gap-2">
                      <form action={updateMemberRoleAction} className="flex items-end gap-2">
                        <input type="hidden" name="id" value={member.id} />
                        <div>
                          <label
                            htmlFor={`role-${member.id}`}
                            className="label mb-1 block"
                          >
                            Rol
                          </label>
                          <select
                            id={`role-${member.id}`}
                            name="role"
                            defaultValue={member.role}
                            className="select h-8 text-xs"
                          >
                            {ROLE_ORDER.map((role) => (
                              <option key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <SubmitButton size="sm" pendingText="…">
                          Guardar
                        </SubmitButton>
                      </form>

                      {isSelf ? null : (
                        <ConfirmForm
                          action={removeMemberAction}
                          message={`¿Retirar el acceso de ${member.fullName}? Podrá volver a ser invitado más adelante.`}
                          confirmLabel="Retirar acceso"
                          trigger={
                            <>
                              <Trash2 className="h-3 w-3" aria-hidden />
                              Retirar
                            </>
                          }
                          triggerClassName="btn-ghost btn-sm text-danger"
                        >
                          <input type="hidden" name="id" value={member.id} />
                        </ConfirmForm>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 border border-line bg-paper p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-olive" aria-hidden />
              <p className="text-xs font-semibold">Qué puede hacer cada rol</p>
            </div>
            <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="font-medium">Propietario</dt>
                <dd className="mt-0.5 leading-relaxed text-ink-faint">
                  Todo, incluida la gestión del equipo y la suscripción.
                </dd>
              </div>
              <div>
                <dt className="font-medium">Encargado</dt>
                <dd className="mt-0.5 leading-relaxed text-ink-faint">
                  Carta, mesas, impresión, estadísticas y auditoría.
                </dd>
              </div>
              <div>
                <dt className="font-medium">Sala</dt>
                <dd className="mt-0.5 leading-relaxed text-ink-faint">
                  Abrir mesas, tomar comandas, servir y gestionar cuentas.
                </dd>
              </div>
              <div>
                <dt className="font-medium">Cocina</dt>
                <dd className="mt-0.5 leading-relaxed text-ink-faint">
                  Ver el pase y avanzar el estado de los platos.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <aside className="panel h-fit p-5">
          <h2 className="text-sm font-semibold">Añadir al equipo</h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-faint">
            Se crea una cuenta nueva o se añade una existente a este restaurante.
          </p>
          <div className="mt-4">
            <InviteMemberForm />
          </div>
        </aside>
      </div>
    </div>
  );
}
