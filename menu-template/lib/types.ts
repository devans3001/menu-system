// Typed menu data model. Deliberately NOT Category-Item-Price.
// See research-menu-taxonomy.md for why each shape exists.

export type PriceType = "fixed" | "market" | "per_person" | "per_weight" | "free" | "none";
export type DietaryTag = "vegetarian" | "vegan" | "gluten_free" | "halal" | "dairy_free" | "nut_free" | "spicy";
export type Allergen = "milk" | "egg" | "peanut" | "tree_nut" | "soy" | "wheat" | "gluten" | "fish" | "shellfish" | "sesame" | "sulphites" | "mustard" | "celery" | "lupin" | "molluscs";
export type BadgeType = "bestseller" | "chefs_pick" | "new" | "popular" | "iconic" | "premium" | "sharing" | "spicy" | "custom";
export type AutoReturnPreset = "end_of_service" | "tomorrow" | "indefinite" | "custom";
export type SpecialRuleType = "percent_off" | "amount_off" | "fixed_special_price" | "buy_x_get_y" | "bundle_price";

export interface ScheduleWindow { start: string; end: string } // HH:mm, end may be earlier than start for overnight
export interface Schedule {
  days: number[]; // 0 Sunday .. 6 Saturday
  windows: ScheduleWindow[];
  startsAt?: string; // ISO date
  endsAt?: string; // ISO date
}

export interface Venue {
  id: string;
  slug: string;
  name: string;
  currency: string;
  timezone: string;
  defaultLocale: string;
}

export interface MenuEntity {
  id: string;
  venueId: string;
  name: string;
  schedule: Schedule;
  precedence: number; // higher wins when schedules overlap
  taxIncluded: boolean;
  priceNote: string;
  sectionIds: string[];
}

export interface Section {
  id: string;
  name: string;
  note?: string;
  parentId?: string | null;
  sortOrder: number;
  itemIds: string[];
  childSectionIds: string[];
}

export interface WineFields {
  producer?: string;
  vintage?: string;
  appellation?: string;
  glassPrice?: number | null;
  carafePrice?: number | null;
  bottlePrice?: number | null;
}

export interface Item {
  id: string;
  name: string;
  subtitle?: string;
  description: string;
  photoUrl?: string;
  basePrice: number | null;
  priceType: PriceType;
  priceUnit?: string; // e.g. per 100g, per piece
  todaysMarketPrice?: number | null;
  dietaryTags: DietaryTag[]; // suitable-for, separate from allergens
  allergenContains: Allergen[]; // contains, separate from dietary
  badges: { type: BadgeType; label: string }[];
  serves?: string;
  isHot: boolean; // drives THE STEAM
  active: boolean; // catalogue membership, separate from 86 availability
  wine?: WineFields;
  variantIds: string[];
  modifierGroupIds: string[];
  calories?: number | null;
}

export interface Variant {
  id: string;
  itemId: string;
  name: string;
  price: number | null;
  priceType: PriceType;
  sortOrder: number;
  active: boolean;
}

// Modifier option price can depend on the chosen variant.
// If priceByVariant is present it overrides base price for that variant.
export interface ModifierOption {
  id: string;
  groupId: string;
  name: string;
  price: number;
  priceByVariant?: Record<string, number>;
  sortOrder: number;
}

export interface ModifierGroup {
  id: string;
  itemId: string;
  name: string;
  min: number;
  max: number;
  required: boolean;
  sortOrder: number;
  optionIds: string[];
}

export interface BundleSlot {
  id: string;
  label: string;
  chooseCount: number;
  optionItemIds: string[];
  supplements: Record<string, number>; // itemId -> supplement price
}

export interface Bundle {
  id: string;
  name: string;
  description: string;
  price: number | null;
  priceType: PriceType;
  slots: BundleSlot[];
  photoUrl?: string;
}

export interface Special {
  id: string;
  name: string;
  headline: string;
  badgeText: string;
  terms?: string;
  schedule: Schedule;
  ruleType: SpecialRuleType;
  ruleValue: number; // percent, amount, fixed price, or bundle price depending on ruleType
  buyX?: number;
  getY?: number;
  targetItemIds: string[];
  targetSectionIds: string[];
}

export interface Availability {
  entityType: "item" | "variant" | "modifier_option";
  entityId: string;
  soldOut: boolean; // the 86 state, separate from Item.active
  autoReturn: AutoReturnPreset;
  returnAt?: string; // ISO, for custom
  updatedAt: string;
}

export interface MenuDocument {
  venue: Venue;
  menus: MenuEntity[];
  sections: Section[];
  items: Item[];
  variants: Variant[];
  modifierGroups: ModifierGroup[];
  modifierOptions: ModifierOption[];
  bundles: Bundle[];
  specials: Special[];
  availability: Availability[];
  version: number;
  updatedAt: string;
}
