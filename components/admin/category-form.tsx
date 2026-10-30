import Link from "next/link";
import { SubmitButton } from "@/components/ui/submit-button";

export function CategoryForm({
  action,
  category,
  returnTo,
}: {
  action: (formData: FormData) => void | Promise<void>;
  category?: {
    id: string;
    name: string;
    description: string | null;
    sortOrder: number;
    isVisible: boolean;
  };
  returnTo: string;
}) {
  return (
    <form action={action} className="space-y-4">
      {category ? <input type="hidden" name="id" value={category.id} /> : null}
      <input type="hidden" name="returnTo" value={returnTo} />

      <div>
        <label htmlFor="category-name" className="label">
          Nombre de la categoría
        </label>
        <input
          id="category-name"
          name="name"
          required
          maxLength={80}
          defaultValue={category?.name}
          placeholder="Entrantes, Vinos, Postres…"
          className="field mt-1.5"
        />
      </div>

      <div>
        <label htmlFor="category-description" className="label">
          Descripción (opcional)
        </label>
        <textarea
          id="category-description"
          name="description"
          maxLength={300}
          rows={2}
          defaultValue={category?.description ?? ""}
          placeholder="Una nota breve que se muestra bajo el título."
          className="textarea mt-1.5"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="category-sort" className="label">
            Orden
          </label>
          <input
            id="category-sort"
            name="sortOrder"
            type="number"
            min={0}
            max={999}
            defaultValue={category?.sortOrder ?? 0}
            className="field mt-1.5"
          />
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            name="isVisible"
            defaultChecked={category?.isVisible ?? true}
            className="checkbox"
          />
          Visible en la carta pública
        </label>
      </div>

      <div className="flex items-center gap-2 border-t border-line pt-4">
        <SubmitButton>{category ? "Guardar categoría" : "Crear categoría"}</SubmitButton>
        <Link href="/admin/carta" className="btn-secondary">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
