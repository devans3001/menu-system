import type { Allergen, DietaryTag } from "./types";

// Fixed vocabularies for the owner editor's multi-selects. The values are
// the taxonomy enums from lib/types.ts; dietary (suitable for) and
// allergens (contains) stay separate lists on purpose.
export const DIETARY_TAGS: readonly DietaryTag[] = [
  "vegetarian", "vegan", "gluten_free", "halal", "dairy_free", "nut_free", "spicy",
];
export const ALLERGENS: readonly Allergen[] = [
  "milk", "egg", "peanut", "tree_nut", "soy", "wheat", "gluten", "fish",
  "shellfish", "sesame", "sulphites", "mustard", "celery", "lupin", "molluscs",
];
