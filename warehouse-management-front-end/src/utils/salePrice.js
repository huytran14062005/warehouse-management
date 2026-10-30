export const MIN_SALE_PRICE = 500;
export const SALE_PRICE_TOLERANCE = 0.1;

export function getSalePriceBounds(defaultPrice) {
  const base = Number(defaultPrice);
  if (!Number.isFinite(base) || base < MIN_SALE_PRICE) return null;
  return {
    min: Math.max(MIN_SALE_PRICE, Math.ceil(base * (1 - SALE_PRICE_TOLERANCE) - 1e-9)),
    max: Math.floor(base * (1 + SALE_PRICE_TOLERANCE) + 1e-9),
  };
}
