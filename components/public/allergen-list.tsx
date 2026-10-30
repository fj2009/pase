import { allergenLabel } from "@/features/menu/allergens";

export function AllergenList({
  allergens,
  compact = false,
}: {
  allergens: string[];
  compact?: boolean;
}) {
  if (allergens.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="meta-mono">Alérgenos</span>
      {compact ? (
        <span className="text-xs text-ink-soft">
          {allergens.map(allergenLabel).join(" · ")}
        </span>
      ) : (
        <span className="text-xs text-ink-soft">
          {allergens.map(allergenLabel).join(" · ")}
        </span>
      )}
    </div>
  );
}
