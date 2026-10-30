import { PageHeader } from "@/components/ui/page-header";
import { requireCapability } from "@/features/auth/session";
import { getRecentAudit } from "@/features/orders/queries";
import { formatDateTime } from "@/lib/datetime";

export const metadata = { title: "Auditoría · Pase" };

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Inicio de sesión",
  "auth.logout": "Cierre de sesión",
  "service.session_opened": "Mesa abierta",
  "service.session_closed": "Mesa cerrada",
  "orders.order_created": "Comanda creada",
  "orders.items_added": "Platos añadidos",
  "orders.item_status_changed": "Estado de plato",
  "orders.item_cancelled": "Plato cancelado",
  "orders.reprinted": "Ticket reimpreso",
  "bills.status_changed": "Cuenta actualizada",
  "menu.category_created": "Categoría creada",
  "menu.category_updated": "Categoría editada",
  "menu.category_deleted": "Categoría eliminada",
  "menu.item_created": "Plato creado",
  "menu.item_updated": "Plato editado",
  "menu.item_archived": "Plato archivado",
  "menu.item_availability_changed": "Disponibilidad de plato",
  "tables.table_created": "Mesa creada",
  "tables.table_updated": "Mesa editada",
  "tables.table_deleted": "Mesa eliminada",
  "tables.table_deactivated": "Mesa desactivada",
  "tables.qr_regenerated": "QR regenerado",
  "stations.station_created": "Estación creada",
  "stations.station_updated": "Estación editada",
  "stations.station_deleted": "Estación eliminada",
  "printing.printer_created": "Impresora creada",
  "printing.printer_updated": "Impresora editada",
  "printing.printer_deleted": "Impresora eliminada",
  "printing.printer_deactivated": "Impresora desactivada",
  "printing.agent_created": "Agente creado",
  "printing.agent_revoked": "Agente revocado",
  "printing.test_ticket_queued": "Ticket de prueba",
  "printing.job_retried": "Trabajo reintentado",
  "staff.member_invited": "Persona invitada",
  "staff.role_changed": "Rol actualizado",
  "staff.member_removed": "Acceso retirado",
};

function describeMetadata(metadata: Record<string, unknown>): string {
  const entries = Object.entries(metadata).slice(0, 3);
  if (entries.length === 0) return "";
  return entries
    .map(([key, value]) => {
      const text =
        typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
      return `${key}: ${text}`;
    })
    .join(" · ");
}

export default async function AdminAuditPage() {
  const context = await requireCapability("viewAudit");
  const entries = await getRecentAudit(
    context.user.id,
    context.restaurant.restaurantId,
    200,
  );

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Trazabilidad"
        title="Auditoría del restaurante"
        description="Cada cambio sensible queda registrado con su autor, entidad y momento. Solo lectura; no se puede editar desde la aplicación."
      />

      {entries.length === 0 ? (
        <p className="border border-dashed border-line-strong px-4 py-10 text-center text-sm text-ink-faint">
          Todavía no hay actividad registrada.
        </p>
      ) : (
        <ol className="divide-y divide-line border-y border-line">
          {entries.map((entry) => (
            <li key={entry.id} className="grid gap-2 py-3 sm:grid-cols-[150px_1fr]">
              <time
                dateTime={entry.createdAt}
                className="font-mono text-[0.68rem] leading-relaxed text-ink-faint"
              >
                {formatDateTime(entry.createdAt, context.restaurant.timezone)}
              </time>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <p className="text-sm font-medium">
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </p>
                  <span className="meta-mono">{entry.entity}</span>
                </div>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {entry.actorLabel}
                  {entry.entityId ? (
                    <span className="font-mono text-ink-faint">
                      {" "}
                      · {entry.entityId.slice(0, 8)}
                    </span>
                  ) : null}
                </p>
                {Object.keys(entry.metadata).length > 0 ? (
                  <p className="mt-1 break-words font-mono text-[0.65rem] leading-relaxed text-ink-faint">
                    {describeMetadata(entry.metadata)}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
