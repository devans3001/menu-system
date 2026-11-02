export function formatPrice(amount: number | null | undefined, currency = "NGN"): string {
  if (amount === null || amount === undefined) return "";
  if (currency === "NGN") return "₦" + Math.round(amount).toLocaleString("en-NG");
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(amount);
}
export function displayPriceForItem(item: { basePrice: number | null; priceType: string; todaysMarketPrice?: number | null }, currency: string): string {
  if (item.priceType === "market") return item.todaysMarketPrice ? formatPrice(item.todaysMarketPrice, currency) + " today" : "Market price, ask us";
  if (item.priceType === "none" || item.priceType === "free") return item.priceType === "free" ? "Included" : "";
  if (item.priceType === "per_person") return formatPrice(item.basePrice, currency) + " per person";
  if (item.priceType === "per_weight") return formatPrice(item.basePrice, currency) + " per 100g";
  return formatPrice(item.basePrice, currency);
}
