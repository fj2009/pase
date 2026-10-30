import { SubmitButton } from "@/components/ui/submit-button";
import type { AdminPrinter, PrinterKind } from "@/features/printing/admin";

const KINDS: { value: PrinterKind; label: string; hint: string }[] = [
  {
    value: "test",
    label: "Prueba",
    hint: "Solo guarda los tickets en la cola. Útil para montar la carta sin hardware.",
  },
  {
    value: "network",
    label: "Red (TCP)",
    hint: "Impresora ESC/POS accesible por IP, por ejemplo 192.168.1.50:9100.",
  },
  {
    value: "usb_agent",
    label: "USB con agente",
    hint: "El agente local del restaurante imprime en una impresora USB del equipo.",
  },
];

export function PrinterForm({
  action,
  printer,
  stations,
}: {
  action: (formData: FormData) => void | Promise<void>;
  printer?: AdminPrinter;
  stations: { id: string; name: string }[];
}) {
  const assigned = new Set(printer?.stations.map((station) => station.id) ?? []);
  return (
    <form action={action} className="space-y-4">
      {printer ? <input type="hidden" name="id" value={printer.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`printer-name-${printer?.id ?? "new"}`} className="label">
            Nombre
          </label>
          <input
            id={`printer-name-${printer?.id ?? "new"}`}
            name="name"
            required
            maxLength={80}
            defaultValue={printer?.name}
            placeholder="Cocina, Barra, Postres…"
            className="field mt-1.5"
          />
        </div>
        <div>
          <label htmlFor={`printer-kind-${printer?.id ?? "new"}`} className="label">
            Conexión
          </label>
          <select
            id={`printer-kind-${printer?.id ?? "new"}`}
            name="kind"
            defaultValue={printer?.kind ?? "test"}
            className="select mt-1.5"
          >
            {KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <div>
          <label htmlFor={`printer-target-${printer?.id ?? "new"}`} className="label">
            Destino
          </label>
          <input
            id={`printer-target-${printer?.id ?? "new"}`}
            name="target"
            maxLength={200}
            defaultValue={printer?.target ?? ""}
            placeholder="192.168.1.50:9100 o nombre del dispositivo"
            className="field mt-1.5 font-mono text-xs"
          />
          <p className="mt-1 text-[0.68rem] text-ink-faint">
            Obligatorio salvo en impresoras de prueba.
          </p>
        </div>
        <div>
          <label htmlFor={`printer-paper-${printer?.id ?? "new"}`} className="label">
            Papel
          </label>
          <select
            id={`printer-paper-${printer?.id ?? "new"}`}
            name="paperWidth"
            defaultValue={printer?.paperWidth ?? 80}
            className="select mt-1.5"
          >
            <option value={80}>80 mm</option>
            <option value={58}>58 mm</option>
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="label mb-2">Estaciones que imprime</legend>
        {stations.length === 0 ? (
          <p className="border border-dashed border-line px-3 py-2 text-xs text-ink-faint">
            No hay estaciones activas. Crea una en Estaciones para asignarla.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 border border-line bg-paper p-3">
            {stations.map((station) => (
              <label key={station.id} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  name="stationIds"
                  value={station.id}
                  defaultChecked={assigned.has(station.id)}
                  className="checkbox"
                />
                {station.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={printer ? printer.isActive : true}
          className="checkbox"
        />
        Impresora activa
      </label>

      <div className="border-t border-line pt-4">
        <SubmitButton>{printer ? "Guardar impresora" : "Crear impresora"}</SubmitButton>
      </div>
    </form>
  );
}
