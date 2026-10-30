export const ALLERGENS = [
  { key: "gluten", label: "Gluten", short: "GLU" },
  { key: "crustaceos", label: "Crustáceos", short: "CRU" },
  { key: "huevos", label: "Huevos", short: "HUE" },
  { key: "pescado", label: "Pescado", short: "PES" },
  { key: "cacahuetes", label: "Cacahuetes", short: "CAC" },
  { key: "soja", label: "Soja", short: "SOJ" },
  { key: "lacteos", label: "Lácteos", short: "LAC" },
  { key: "frutos_cascara", label: "Frutos de cáscara", short: "FRU" },
  { key: "apio", label: "Apio", short: "API" },
  { key: "mostaza", label: "Mostaza", short: "MOS" },
  { key: "sesamo", label: "Sésamo", short: "SES" },
  { key: "sulfitos", label: "Sulfitos", short: "SUL" },
  { key: "moluscos", label: "Moluscos", short: "MOL" },
  { key: "altramuces", label: "Altramuces", short: "ALT" },
] as const;

export type AllergenKey = (typeof ALLERGENS)[number]["key"];

export const ALLERGEN_KEYS = ALLERGENS.map((allergen) => allergen.key);

const BY_KEY = new Map(ALLERGENS.map((allergen) => [allergen.key, allergen]));

export function allergenLabel(key: string): string {
  return BY_KEY.get(key as AllergenKey)?.label ?? key;
}

export function allergenShort(key: string): string {
  return BY_KEY.get(key as AllergenKey)?.short ?? key.slice(0, 3).toUpperCase();
}

export function isAllergenKey(value: string): value is AllergenKey {
  return BY_KEY.has(value as AllergenKey);
}
