import type { MenuDocument } from "../types";

// Fictional demo restaurant: Ember Palm Kitchen. No real prospect data.
// Demo photos are local files under public/demo so the skin can be judged
// anywhere. Production per-client images live on the client's Cloudinary.
// Proves: (1) swallow soup x protein modifiers with paid extras,
// (2) pizza variant-dependent topping pricing, (3) happy-hour special overlay,
// (4) one 86 item, (5) lunch vs dinner scheduled menus.
export const seedMenu: MenuDocument = {
  venue: { id: "venue-ember-palm", slug: "ember-palm-kitchen", name: "Ember Palm Kitchen", currency: "NGN", timezone: "Africa/Lagos", defaultLocale: "en" },
  version: 1,
  updatedAt: "2026-11-02T09:00:00.000Z",
  menus: [
    {
      id: "menu-lunch", venueId: "venue-ember-palm", name: "Lunch",
      schedule: { days: [1,2,3,4,5], windows: [{ start: "11:00", end: "16:00" }] },
      precedence: 10, taxIncluded: true, priceNote: "All prices include taxes.",
      sectionIds: ["sec-lunch-mains", "sec-drinks"],
    },
    {
      id: "menu-dinner", venueId: "venue-ember-palm", name: "Dinner",
      schedule: { days: [0,1,2,3,4,5,6], windows: [{ start: "16:00", end: "23:00" }] },
      precedence: 20, taxIncluded: true, priceNote: "All prices include taxes.",
      sectionIds: ["sec-swallow", "sec-grill", "sec-pizza", "sec-drinks", "sec-dessert"],
    },
    {
      id: "menu-late", venueId: "venue-ember-palm", name: "Late Night",
      schedule: { days: [5,6], windows: [{ start: "22:00", end: "02:00" }] },
      precedence: 5, taxIncluded: true, priceNote: "All prices include taxes. Late night kitchen closes 30 minutes before close.",
      sectionIds: ["sec-grill", "sec-drinks"],
    },
  ],
  sections: [
    { id: "sec-swallow", name: "Swallow and Soups", note: "Choose your swallow, then your soup, then your protein.", parentId: null, sortOrder: 1, itemIds: ["item-swallow-soup", "item-extra-swallow"], childSectionIds: [] },
    { id: "sec-grill", name: "From the Charcoal Grill", note: "Cooked over charcoal. Served with house pepper sauce.", parentId: null, sortOrder: 2, itemIds: ["item-charcoal-chicken", "item-grilled-tilapia", "item-suya-platter"], childSectionIds: [] },
    { id: "sec-pizza", name: "Wood Fired Pizza", note: "", parentId: null, sortOrder: 3, itemIds: ["item-ember-pizza"], childSectionIds: [] },
    { id: "sec-lunch-mains", name: "Lunch Mains", note: "Lunch portions, served fast.", parentId: null, sortOrder: 1, itemIds: ["item-jollof", "item-charcoal-chicken"], childSectionIds: [] },
    { id: "sec-drinks", name: "Drinks", note: "", parentId: null, sortOrder: 4, itemIds: ["item-palm-wine", "item-chapman", "item-house-red"], childSectionIds: [] },
    { id: "sec-dessert", name: "Dessert", note: "", parentId: null, sortOrder: 5, itemIds: ["item-puff-puff"], childSectionIds: [] },
  ],
  items: [
    {
      id: "item-swallow-soup", name: "Swallow and Soup", subtitle: "Build your pairing",
      description: "One swallow, one soup, one protein. Extra meat and extra fish can be added below. This is the pairing at the heart of the kitchen.",
      photoUrl: "https://images.unsplash.com/photo-1548943487-a2e4e43b4853?q=80&w=1080&auto=format&fit=crop",
      basePrice: 6500, priceType: "fixed", dietaryTags: [], allergenContains: [],
      badges: [{ type: "iconic", label: "House classic" }], serves: "1", isHot: true, active: true,
      variantIds: ["var-swallow-pounded-yam", "var-swallow-eba", "var-swallow-amala"],
      modifierGroupIds: ["grp-soup", "grp-protein", "grp-extras"],
    },
    {
      id: "item-extra-swallow", name: "Extra Swallow", description: "An extra wrap of your chosen swallow.",
      photoUrl: "https://images.unsplash.com/photo-1512058564366-18510be2db19?q=80&w=1080&auto=format&fit=crop",
      basePrice: 1500, priceType: "fixed", dietaryTags: ["vegan"], allergenContains: [],
      badges: [], isHot: false, active: true, variantIds: [], modifierGroupIds: [],
    },
    {
      id: "item-charcoal-chicken", name: "Charcoal Chicken", subtitle: "Signature dish",
      description: "Half chicken marinated overnight, finished over charcoal until the skin crisps. Served with grilled plantain and pepper sauce.",
      photoUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1080&auto=format&fit=crop",
      basePrice: 12000, priceType: "fixed", dietaryTags: ["halal"], allergenContains: [],
      badges: [{ type: "bestseller", label: "Bestseller" }], serves: "1 to 2", isHot: true, active: true,
      variantIds: [], modifierGroupIds: [],
    },
    {
      id: "item-grilled-tilapia", name: "Charcoal Grilled Fish", description: "The day's fish with house spice, grilled over charcoal to order. Market fish, priced by the catch.",
      photoUrl: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=1080&auto=format&fit=crop",
      basePrice: null, priceType: "market", todaysMarketPrice: 14500, dietaryTags: [], allergenContains: ["fish"],
      badges: [], isHot: true, active: true, variantIds: [], modifierGroupIds: [],
    },
    {
      id: "item-suya-platter", name: "Suya Platter", description: "Beef and chicken suya with onions, cucumber and extra yaji on the side. Built for the table.",
      photoUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1080&auto=format&fit=crop",
      basePrice: 16000, priceType: "fixed", dietaryTags: ["spicy"], allergenContains: ["peanut"],
      badges: [{ type: "sharing", label: "Sharing" }, { type: "spicy", label: "Spicy" }], serves: "3 to 4", isHot: true, active: true,
      variantIds: [], modifierGroupIds: [],
    },
    {
      id: "item-ember-pizza", name: "Ember Pizza", subtitle: "Build your own",
      description: "Wood fired base with tomato, mozzarella and basil. Choose a size, then add toppings. Topping prices change with pizza size.",
      photoUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=1080&auto=format&fit=crop",
      basePrice: null, priceType: "fixed", dietaryTags: ["vegetarian"], allergenContains: ["wheat", "gluten", "milk"],
      badges: [], isHot: true, active: true,
      variantIds: ["var-pizza-small", "var-pizza-medium", "var-pizza-large"],
      modifierGroupIds: ["grp-pizza-toppings", "grp-pizza-crust"],
    },
    {
      id: "item-jollof", name: "Smoky Jollof Rice", description: "Party style jollof cooked over firewood smoke, with fried plantain.",
      photoUrl: "https://images.unsplash.com/photo-1574484284002-952d92456975?q=80&w=1080&auto=format&fit=crop",
      basePrice: 7000, priceType: "fixed", dietaryTags: ["vegan"], allergenContains: [],
      badges: [{ type: "popular", label: "Popular" }], isHot: true, active: true, variantIds: [], modifierGroupIds: [],
    },
    {
      id: "item-palm-wine", name: "Fresh Palm Wine", description: "Tapped fresh, served chilled in a calabash glass.",
      photoUrl: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?q=80&w=1080&auto=format&fit=crop",
      basePrice: 3500, priceType: "fixed", dietaryTags: ["vegan", "gluten_free"], allergenContains: [],
      badges: [], isHot: false, active: true, variantIds: [], modifierGroupIds: [],
    },
    {
      id: "item-chapman", name: "Chapman", description: "The house chapman, bitter lemon, grenadine and cucumber, no alcohol version available on request.",
      photoUrl: "https://images.unsplash.com/photo-1544145945-f90425340c7e?q=80&w=1080&auto=format&fit=crop",
      basePrice: 4000, priceType: "fixed", dietaryTags: ["vegan"], allergenContains: [],
      badges: [], isHot: false, active: true, variantIds: [], modifierGroupIds: [],
    },
    {
      id: "item-house-red", name: "House Red Wine", description: "A soft red chosen for grilled meats.",
      photoUrl: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?q=80&w=1080&auto=format&fit=crop",
      basePrice: null, priceType: "fixed", dietaryTags: [], allergenContains: ["sulphites"],
      badges: [], isHot: false, active: true, variantIds: [], modifierGroupIds: [],
      wine: { producer: "Demo Estate", vintage: "2021", appellation: "Western Cape", glassPrice: 5000, carafePrice: 12000, bottlePrice: 22000 },
    },
    {
      id: "item-puff-puff", name: "Puff Puff and Ginger Ice Cream", description: "Warm puff puff with ginger ice cream and a honey drizzle.",
      photoUrl: "https://images.unsplash.com/photo-1551024506-0bccd828d307?q=80&w=1080&auto=format&fit=crop",
      basePrice: 4500, priceType: "fixed", dietaryTags: ["vegetarian"], allergenContains: ["wheat", "gluten", "milk", "egg"],
      badges: [{ type: "new", label: "New" }], isHot: false, active: true, variantIds: [], modifierGroupIds: [],
    },
  ],
  variants: [
    { id: "var-swallow-pounded-yam", itemId: "item-swallow-soup", name: "Pounded yam", price: null, priceType: "fixed", sortOrder: 1, active: true },
    { id: "var-swallow-eba", itemId: "item-swallow-soup", name: "Eba", price: null, priceType: "fixed", sortOrder: 2, active: true },
    { id: "var-swallow-amala", itemId: "item-swallow-soup", name: "Amala", price: null, priceType: "fixed", sortOrder: 3, active: true },
    { id: "var-pizza-small", itemId: "item-ember-pizza", name: "Small 9 inch", price: 8000, priceType: "fixed", sortOrder: 1, active: true },
    { id: "var-pizza-medium", itemId: "item-ember-pizza", name: "Medium 12 inch", price: 11000, priceType: "fixed", sortOrder: 2, active: true },
    { id: "var-pizza-large", itemId: "item-ember-pizza", name: "Large 16 inch", price: 15000, priceType: "fixed", sortOrder: 3, active: true },
  ],
  modifierGroups: [
    { id: "grp-soup", itemId: "item-swallow-soup", name: "Choose your soup", min: 1, max: 1, required: true, sortOrder: 1, optionIds: ["opt-soup-egusi", "opt-soup-efo", "opt-soup-ogbono", "opt-soup-okro"] },
    { id: "grp-protein", itemId: "item-swallow-soup", name: "Choose your protein", min: 1, max: 2, required: true, sortOrder: 2, optionIds: ["opt-protein-assorted", "opt-protein-goat", "opt-protein-fish", "opt-protein-stockfish"] },
    { id: "grp-extras", itemId: "item-swallow-soup", name: "Paid extras", min: 0, max: 4, required: false, sortOrder: 3, optionIds: ["opt-extra-meat", "opt-extra-fish", "opt-extra-ponmo"] },
    { id: "grp-pizza-toppings", itemId: "item-ember-pizza", name: "Toppings (priced by size)", min: 0, max: 6, required: false, sortOrder: 1, optionIds: ["opt-top-cheese", "opt-top-chicken", "opt-top-pepperoni"] },
    { id: "grp-pizza-crust", itemId: "item-ember-pizza", name: "Crust", min: 1, max: 1, required: true, sortOrder: 2, optionIds: ["opt-crust-thin", "opt-crust-thick"] },
  ],
  modifierOptions: [
    { id: "opt-soup-egusi", groupId: "grp-soup", name: "Egusi", price: 0, sortOrder: 1 },
    { id: "opt-soup-efo", groupId: "grp-soup", name: "Efo riro", price: 0, sortOrder: 2 },
    { id: "opt-soup-ogbono", groupId: "grp-soup", name: "Ogbono", price: 0, sortOrder: 3 },
    { id: "opt-soup-okro", groupId: "grp-soup", name: "Okro", price: 0, sortOrder: 4 },
    { id: "opt-protein-assorted", groupId: "grp-protein", name: "Assorted meat", price: 0, sortOrder: 1 },
    { id: "opt-protein-goat", groupId: "grp-protein", name: "Goat meat", price: 500, sortOrder: 2 },
    { id: "opt-protein-fish", groupId: "grp-protein", name: "Fried fish", price: 800, sortOrder: 3 },
    { id: "opt-protein-stockfish", groupId: "grp-protein", name: "Stockfish", price: 1000, sortOrder: 4 },
    { id: "opt-extra-meat", groupId: "grp-extras", name: "Extra meat (per piece)", price: 1500, sortOrder: 1 },
    { id: "opt-extra-fish", groupId: "grp-extras", name: "Extra fish (per piece)", price: 2000, sortOrder: 2 },
    { id: "opt-extra-ponmo", groupId: "grp-extras", name: "Extra ponmo", price: 800, sortOrder: 3 },
    // Variant-dependent pricing: same topping costs more on a larger pizza.
    { id: "opt-top-cheese", groupId: "grp-pizza-toppings", name: "Extra cheese", price: 1000, priceByVariant: { "var-pizza-small": 800, "var-pizza-medium": 1200, "var-pizza-large": 1600 }, sortOrder: 1 },
    { id: "opt-top-chicken", groupId: "grp-pizza-toppings", name: "Charcoal chicken", price: 1800, priceByVariant: { "var-pizza-small": 1500, "var-pizza-medium": 2000, "var-pizza-large": 2800 }, sortOrder: 2 },
    { id: "opt-top-pepperoni", groupId: "grp-pizza-toppings", name: "Pepperoni", price: 1800, priceByVariant: { "var-pizza-small": 1500, "var-pizza-medium": 2000, "var-pizza-large": 2800 }, sortOrder: 3 },
    { id: "opt-crust-thin", groupId: "grp-pizza-crust", name: "Thin", price: 0, sortOrder: 1 },
    { id: "opt-crust-thick", groupId: "grp-pizza-crust", name: "Thick", price: 500, sortOrder: 2 },
  ],
  bundles: [
    {
      id: "bundle-family", name: "Family Ember Platter", description: "Built for four. Choose your grill mains and your sides.",
      price: 38000, priceType: "fixed",
      photoUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1080&auto=format&fit=crop",
      slots: [
        { id: "slot-mains", label: "Choose 2 grill mains", chooseCount: 2, optionItemIds: ["item-charcoal-chicken", "item-suya-platter", "item-grilled-tilapia"], supplements: { "item-grilled-tilapia": 3000 } },
        { id: "slot-sides", label: "Choose 2 sides", chooseCount: 2, optionItemIds: ["item-jollof", "item-extra-swallow", "item-puff-puff"], supplements: {} },
      ],
    },
  ],
  specials: [
    {
      id: "special-happy-hour", name: "Happy Hour", headline: "Happy hour, 25 percent off drinks",
      badgeText: "Happy hour", terms: "Monday to Friday, 4pm to 7pm. Drinks section only. Dine in.",
      schedule: { days: [1,2,3,4,5], windows: [{ start: "16:00", end: "19:00" }] },
      ruleType: "percent_off", ruleValue: 25,
      targetItemIds: [], targetSectionIds: ["sec-drinks"],
    },
    {
      id: "special-lunch-jollof", name: "Lunch Jollof Deal", headline: "Jollof at a lunch price",
      badgeText: "Lunch deal", terms: "Weekday lunch only.",
      schedule: { days: [1,2,3,4,5], windows: [{ start: "11:00", end: "16:00" }] },
      ruleType: "fixed_special_price", ruleValue: 5500,
      targetItemIds: ["item-jollof"], targetSectionIds: [],
    },
  ],
  availability: [
    // The demo 86: grilled tilapia is sold out, auto-returns tomorrow.
    { entityType: "item", entityId: "item-grilled-tilapia", soldOut: true, autoReturn: "tomorrow", updatedAt: "2026-11-02T09:00:00.000Z" },
    { entityType: "item", entityId: "item-charcoal-chicken", soldOut: false, autoReturn: "indefinite", updatedAt: "2026-11-02T09:00:00.000Z" },
  ],
};
