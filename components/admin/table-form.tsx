import Link from "next/link";
import { SubmitButton } from "@/components/ui/submit-button";

export function TableForm({
  action,
  table,
  returnTo,
  zones = [],
}: {
  action: (formData: FormData) => void | Promise<void>;
  table?: {
    id: string;
    label: string;
    zone: string | null;
    seats: number;
    isActive: boolean;
  };
  returnTo: string;
  zones?: string[];
}) {
  return (
    <form action={action} className="space-y-4">
      {table ? <input type="hidden" name="id" value={table.id} /> : null}
      <input type="hidden" name="returnTo" value={returnTo} />

      <div>
        <label htmlFor="table-label" className="label">
          Nombre de la mesa
        </label>
        <input
          id="table-label"
          name="label"
          required
          maxLength={40}
          defaultValue={table?.label}
          placeholder="Mesa 12, Barra 2, Terraza 4…"
          className="field mt-1.5"
        />
        <p className="mt-1 text-[0.68rem] text-ink-faint">
          Debe ser único dentro del restaurante. Aparece en la carta y en cocina.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="table-zone" className="label">
            Zona
          </label>
          <input
            id="table-zone"
            name="zone"
            maxLength={40}
            defaultValue={table?.zone ?? ""}
            placeholder="Sala, Terraza, Barra…"
            list="table-zones"
            className="field mt-1.5"
          />
          <datalist id="table-zones">
            {zones.map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="table-seats" className="label">
            Comensales
          </label>
          <input
            id="table-seats"
            name="seats"
            type="number"
            min={1}
            max={40}
            required
            defaultValue={table?.seats ?? 2}
            className="field mt-1.5"
          />
          <datalist id="table-zones">
            {zones.map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={table ? table.isActive : true}
          className="checkbox"
        />
        Mesa activa en el mapa de sala
      </label>

      <div className="flex items-center gap-2 border-t border-line pt-4">
        <SubmitButton>{table ? "Guardar mesa" : "Crear mesa"}</SubmitButton>
        <Link href="/admin/mesas" className="btn-secondary">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
