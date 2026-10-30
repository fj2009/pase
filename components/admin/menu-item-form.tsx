import Link from "next/link";
import { SubmitButton } from "@/components/ui/submit-button";
import { ALLERGENS } from "@/features/menu/allergens";
import type { AdminMenuItem } from "@/features/menu/admin";

function priceValue(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function MenuItemForm({
  action,
  categories,
  stations,
  item,
  defaultCategoryId,
  returnTo,
  images,
}: {
  action: (formData: FormData) => void | Promise<void>;
  categories: { id: string; name: string }[];
  stations: { id: string; name: string }[];
  item?: AdminMenuItem;
  defaultCategoryId?: string;
  returnTo: string;
  images: string[];
}) {
  return (
    <form action={action} className="space-y-6">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <input type="hidden" name="returnTo" value={returnTo} />

      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <div>
          <label htmlFor="item-name" className="label">
            Nombre del plato
          </label>
          <input
            id="item-name"
            name="name"
            required
            maxLength={120}
            defaultValue={item?.name}
            placeholder="Croquetas de jamón ibérico"
            className="field mt-1.5"
          />
        </div>
        <div>
          <label htmlFor="item-price" className="label">
            Precio (EUR)
          </label>
          <input
            id="item-price"
            name="price"
            required
            inputMode="decimal"
            defaultValue={item ? priceValue(item.priceCents) : ""}
            placeholder="9,50"
            className="field mt-1.5 font-mono"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="item-category" className="label">
            Categoría
          </label>
          <select
            id="item-category"
            name="categoryId"
            required
            defaultValue={item?.categoryId ?? defaultCategoryId ?? categories[0]?.id}
            className="select mt-1.5"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="item-station" className="label">
            Estación de cocina
          </label>
          <select
            id="item-station"
            name="stationId"
            required
            defaultValue={item?.stationId ?? stations[0]?.id}
            className="select mt-1.5"
          >
            {stations.map((station) => (
              <option key={station.id} value={station.id}>
                {station.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="item-description" className="label">
          Descripción para la carta
        </label>
        <textarea
          id="item-description"
          name="description"
          maxLength={500}
          rows={3}
          defaultValue={item?.description ?? ""}
          placeholder="Qué lleva, cómo se prepara, para compartir…"
          className="textarea mt-1.5"
        />
      </div>

      <div>
        <label htmlFor="item-ingredients" className="label">
          Ingredientes declarados
        </label>
        <textarea
          id="item-ingredients"
          name="ingredients"
          maxLength={500}
          rows={2}
          defaultValue={item?.ingredients ?? ""}
          placeholder="Patata, huevo, cebolla y aceite de oliva."
          className="textarea mt-1.5"
        />
        <p className="mt-1 text-[0.68rem] text-ink-faint">
          Se muestra a los clientes junto a los alérgenos. Es obligatorio declarar la
          información alimentaria relevante.
        </p>
      </div>

      <fieldset>
        <legend className="label mb-2">Alérgenos</legend>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 border border-line bg-paper p-3 sm:grid-cols-4">
          {ALLERGENS.map((allergen) => (
            <label key={allergen.key} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                name="allergens"
                value={allergen.key}
                defaultChecked={item?.allergens.includes(allergen.key)}
                className="checkbox"
              />
              {allergen.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-[1fr_120px_120px]">
        <div>
          <label htmlFor="item-image" className="label">
            Imagen
          </label>
          <input
            id="item-image"
            name="imageUrl"
            list="demo-images"
            maxLength={500}
            defaultValue={item?.imageUrl ?? ""}
            placeholder="/demo/croquetas.jpg"
            className="field mt-1.5 font-mono text-xs"
          />
          <datalist id="demo-images">
            {images.map((image) => (
              <option key={image} value={image} />
            ))}
          </datalist>
          <p className="mt-1 text-[0.68rem] text-ink-faint">
            Ruta local (/demo/…) o URL https. Se recomienda 1200×900.
          </p>
        </div>
        <div>
          <label htmlFor="item-prep" className="label">
            Prep. (min)
          </label>
          <input
            id="item-prep"
            name="prepMinutes"
            type="number"
            min={1}
            max={180}
            required
            defaultValue={item?.prepMinutes ?? 10}
            className="field mt-1.5"
          />
        </div>
        <div>
          <label htmlFor="item-sort" className="label">
            Orden
          </label>
          <input
            id="item-sort"
            name="sortOrder"
            type="number"
            min={0}
            max={999}
            defaultValue={item?.sortOrder ?? 0}
            className="field mt-1.5"
          />
        </div>
      </div>

      {item?.imageUrl ? (
        <div className="flex items-center gap-3 border border-line bg-paper p-2">
          <img
            src={item.imageUrl}
            alt=""
            width={120}
            height={90}
            className="h-16 w-24 object-cover"
          />
          <p className="text-[0.68rem] text-ink-faint">
            Imagen actual. Cambia la ruta para sustituirla.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-5 border-t border-line pt-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isAvailable"
            defaultChecked={item ? item.isAvailable : true}
            className="checkbox"
          />
          Disponible
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isPublished"
            defaultChecked={item ? item.isPublished : true}
            className="checkbox"
          />
          Publicado en la carta
        </label>
      </div>

      <div className="flex items-center gap-2">
        <SubmitButton>{item ? "Guardar cambios" : "Crear plato"}</SubmitButton>
        <Link href="/admin/carta" className="btn-secondary">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
